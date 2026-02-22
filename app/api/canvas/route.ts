import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const TEXT_EXTENSIONS = ["txt", "html", "htm", "md", "csv", "json", "xml", "rtf"];
const MAX_ATTACHED_FILES = 10;

// Extract Canvas file IDs from HTML (links like /courses/123/files/456 or /files/456)
function extractFileIds(html: string, courseId: string): number[] {
  const ids = new Set<number>();
  // Match /courses/:id/files/:fileId or /files/:fileId
  const patterns = [
    new RegExp(`/courses/${courseId}/files/(\\d+)`, "gi"),
    new RegExp(`/files/(\\d+)(?:/download)?`, "gi"),
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) ids.add(parseInt(m[1], 10));
  }
  return Array.from(ids).slice(0, MAX_ATTACHED_FILES);
}

// Strips HTML tags and returns plain text, preserving alt/title for images and link text
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, " $1 ")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<a[^>]*href=["'][^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, domain, token, courseId, itemType, itemId, pageUrl } = body;

  const baseUrl = `https://${domain}/api/v1`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timeout);
    }
  };

  async function fetchFileContent(
    fileId: number,
    courseId: string,
    htmlContent: string
  ): Promise<string> {
    const fileRes = await fetchWithTimeout(
      `${baseUrl}/courses/${courseId}/files/${fileId}`,
      { headers }
    );
    if (!fileRes.ok) return "";
    const file = (await fileRes.json()) as {
      url?: string;
      display_name?: string;
      size?: number;
      "content-type"?: string;
    };
    if (!file.url || (file.size ?? 0) > MAX_FILE_SIZE) return "";
    const ext = (file.display_name ?? "").split(".").pop()?.toLowerCase() ?? "";
    const contentType = (file["content-type"] ?? "").toLowerCase();

    // Canvas download URLs include a verifier - use WITHOUT Bearer (verifier authenticates)
    // Passing Bearer can cause redirects to strip auth and return HTML error pages
    const downloadHeaders: HeadersInit = {
      "User-Agent": "StudyVoice/1.0 (Canvas Integration)",
    };
    let fileRes2 = await fetchWithTimeout(file.url, { headers: downloadHeaders });
    if (!fileRes2.ok) {
      fileRes2 = await fetchWithTimeout(file.url, {
        headers: { ...downloadHeaders, Authorization: `Bearer ${token}` },
      });
    }
    if (!fileRes2.ok) return "";
    const buffer = Buffer.from(await fileRes2.arrayBuffer());

    // If we got HTML (error/login page) instead of the file, bail early
    const resContentType = fileRes2.headers.get("content-type") ?? "";
    if (resContentType.toLowerCase().includes("text/html")) return "";

    if (TEXT_EXTENSIONS.includes(ext) || contentType.includes("text") || contentType.includes("html")) {
      return buffer.toString("utf-8", 0, Math.min(buffer.length, 500000));
    }
    if (ext === "pdf" || contentType.includes("pdf")) {
      // Verify we have actual PDF content (magic bytes %PDF)
      const isPdf =
        buffer.length >= 5 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46;
      if (!isPdf) {
        // Likely got HTML error page instead of PDF - check server logs for buffer preview
        if (process.env.NODE_ENV === "development" && buffer.length < 2000) {
          const preview = buffer.toString("utf-8", 0, 200);
          if (preview.startsWith("<") || preview.includes("<!DOCTYPE")) {
            console.warn("[Canvas] PDF fetch returned HTML instead of PDF. Try file URL without auth.");
          }
        }
        return "";
      }

      let text = "";
      // pdf-parse 1.x has simple API: pdf(buffer) => { text }
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(buffer);
        text = data?.text ?? "";
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[Canvas] pdf-parse failed:", err instanceof Error ? err.message : err);
        }
        // Fallback to officeparser
        try {
          const { parseOffice } = await import("officeparser");
          const ast = await parseOffice(buffer);
          text = typeof ast.toText === "function" ? ast.toText() : "";
        } catch {
          // Both parsers failed - may be scanned/image-only PDF (no text layer)
        }
      }
      return (text ?? "").slice(0, 100000);
    }
    // PowerPoint (PPTX) and other Office formats - officeparser supports Buffer input
    if (
      ["pptx", "ppt", "odp"].includes(ext) ||
      contentType.includes("presentation") ||
      contentType.includes("powerpoint") ||
      contentType.includes("opendocument.presentation")
    ) {
      try {
        const { parseOffice } = await import("officeparser");
        const ast = await parseOffice(buffer, {
          ignoreNotes: false,
          putNotesAtLast: true,
        });
        const text = typeof ast.toText === "function" ? ast.toText() : "";
        return (text ?? "").slice(0, 100000);
      } catch {
        return "";
      }
    }
    return "";
  }

  async function appendLinkedFiles(
    content: string,
    htmlContent: string,
    courseId: string
  ): Promise<string> {
    const fileIds = extractFileIds(htmlContent, courseId);
    if (fileIds.length === 0) return content;
    const parts: string[] = [content];
    for (const fileId of fileIds) {
      try {
        const fileContent = await fetchFileContent(fileId, courseId, htmlContent);
        if (fileContent.trim()) {
          parts.push(`\n\n--- Attached file (ID ${fileId}) ---\n${fileContent.trim()}`);
        }
      } catch {
        // Skip failed files
      }
    }
    return parts.join("");
  }

  try {
    if (action === "validate") {
      // Just fetch the user profile to validate the token
      const res = await fetchWithTimeout(`${baseUrl}/users/self`, { headers });
      if (!res.ok) {
        return NextResponse.json(
          { error: "Invalid token or domain" },
          { status: 401 }
        );
      }
      const user = await res.json();
      return NextResponse.json({ valid: true, name: user.name });
    }

    if (action === "courses") {
      const res = await fetchWithTimeout(
        `${baseUrl}/courses?enrollment_state=active&per_page=50&include[]=term`,
        { headers }
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: `Canvas API error: ${res.status}` },
          { status: res.status }
        );
      }
      const data = await res.json();
      const courses = data.map(
        (c: Record<string, unknown>) => ({
          id: c.id,
          name: c.name ?? "Untitled Course",
          courseCode: c.course_code ?? "",
          term: (c.term as Record<string, unknown>)?.name ?? null,
        })
      );
      return NextResponse.json({ courses });
    }

    if (action === "modules") {
      const res = await fetchWithTimeout(
        `${baseUrl}/courses/${courseId}/modules?include[]=items&per_page=50`,
        { headers }
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: `Canvas API error: ${res.status}` },
          { status: res.status }
        );
      }
      const data = await res.json();
      const modules = data.map(
        (m: Record<string, unknown>) => ({
          id: m.id,
          name: m.name,
          position: m.position,
          items: ((m.items as Array<Record<string, unknown>>) ?? []).map(
            (item) => ({
              id: item.id,
              title: item.title,
              type: item.type,
              contentId: item.content_id ?? null,
              pageUrl: item.page_url ?? null,
            })
          ),
        })
      );
      return NextResponse.json({ modules });
    }

    if (action === "content") {
      let title = "Untitled";
      let content = "";

      if (itemType === "Page" && (pageUrl || itemId)) {
        // Try page_url (slug) first, then page_id:id as fallback
        const pagePath = pageUrl ?? `page_id:${itemId}`;
        const res = await fetchWithTimeout(
          `${baseUrl}/courses/${courseId}/pages/${pagePath}`,
          { headers }
        );
        if (!res.ok) throw new Error(`Canvas API error: ${res.status}`);
        const page = await res.json();
        title = page.title ?? "Untitled Page";
        const pageBody = page.body ?? "";
        content = stripHtml(pageBody);
        content = await appendLinkedFiles(content, pageBody, courseId);
      } else if (itemType === "Assignment" && itemId) {
        const res = await fetchWithTimeout(
          `${baseUrl}/courses/${courseId}/assignments/${itemId}?include[]=rubric`,
          { headers }
        );
        if (!res.ok) throw new Error(`Canvas API error: ${res.status}`);
        const assignment = await res.json();
        title = assignment.name ?? "Untitled Assignment";
        const descHtml = assignment.description ?? "";
        content = stripHtml(descHtml);

        // Append rubric criteria (grading instructions) when present
        const rubric = assignment.rubric as Array<{
          description?: string;
          long_description?: string;
          ratings?: Array<{ description?: string; long_description?: string }>;
        }> | undefined;
        if (Array.isArray(rubric) && rubric.length > 0) {
          const rubricText = rubric
            .map((c, i) => {
              const desc = c.long_description || c.description || "";
              const ratings = (c.ratings ?? [])
                .map((r) => r.long_description || r.description || "")
                .filter(Boolean)
                .join("; ");
              return `Criterion ${i + 1}: ${desc}${ratings ? ` [Ratings: ${ratings}]` : ""}`;
            })
            .join("\n\n");
          content = content ? `${content}\n\n--- Rubric ---\n${rubricText}` : rubricText;
        }

        // Fetch and append linked files (PDFs, docs, etc.) from assignment description
        content = await appendLinkedFiles(content, descHtml, courseId);
      } else if (itemType === "Discussion" && itemId) {
        const res = await fetchWithTimeout(
          `${baseUrl}/courses/${courseId}/discussion_topics/${itemId}`,
          { headers }
        );
        if (!res.ok) throw new Error(`Canvas API error: ${res.status}`);
        const topic = await res.json();
        title = topic.title ?? "Untitled Discussion";
        content = stripHtml(topic.message ?? "");
      } else if (itemType === "Quiz" && itemId) {
        const res = await fetchWithTimeout(
          `${baseUrl}/courses/${courseId}/quizzes/${itemId}`,
          { headers }
        );
        if (!res.ok) throw new Error(`Canvas API error: ${res.status}`);
        const quiz = await res.json();
        title = quiz.title ?? "Untitled Quiz";
        content = stripHtml(quiz.description ?? "");
      } else if (itemType === "File" && itemId) {
        // Direct file content - fetch file and extract text
        content = await fetchFileContent(Number(itemId), courseId, "");
        title = "File";
        const fileRes = await fetchWithTimeout(
          `${baseUrl}/courses/${courseId}/files/${itemId}`,
          { headers }
        );
        if (fileRes.ok) {
          const file = (await fileRes.json()) as { display_name?: string };
          title = file.display_name ?? "File";
        }
      } else {
        return NextResponse.json(
          { error: "Unsupported content type" },
          { status: 400 }
        );
      }

      return NextResponse.json({ title, content });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Request timed out. Check your Canvas domain and network connection."
          : err.message
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
