import { NextRequest, NextResponse } from "next/server";

// Strips HTML tags and returns plain text
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
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

  try {
    if (action === "validate") {
      // Just fetch the user profile to validate the token
      const res = await fetch(`${baseUrl}/users/self`, { headers });
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
      const res = await fetch(
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
      const res = await fetch(
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

      if (itemType === "Page" && pageUrl) {
        const res = await fetch(
          `${baseUrl}/courses/${courseId}/pages/${pageUrl}`,
          { headers }
        );
        if (!res.ok) throw new Error(`Canvas API error: ${res.status}`);
        const page = await res.json();
        title = page.title ?? "Untitled Page";
        content = stripHtml(page.body ?? "");
      } else if (itemType === "Assignment" && itemId) {
        const res = await fetch(
          `${baseUrl}/courses/${courseId}/assignments/${itemId}`,
          { headers }
        );
        if (!res.ok) throw new Error(`Canvas API error: ${res.status}`);
        const assignment = await res.json();
        title = assignment.name ?? "Untitled Assignment";
        content = stripHtml(assignment.description ?? "");
      } else if (itemType === "Discussion" && itemId) {
        const res = await fetch(
          `${baseUrl}/courses/${courseId}/discussion_topics/${itemId}`,
          { headers }
        );
        if (!res.ok) throw new Error(`Canvas API error: ${res.status}`);
        const topic = await res.json();
        title = topic.title ?? "Untitled Discussion";
        content = stripHtml(topic.message ?? "");
      } else if (itemType === "Quiz" && itemId) {
        const res = await fetch(
          `${baseUrl}/courses/${courseId}/quizzes/${itemId}`,
          { headers }
        );
        if (!res.ok) throw new Error(`Canvas API error: ${res.status}`);
        const quiz = await res.json();
        title = quiz.title ?? "Untitled Quiz";
        content = stripHtml(quiz.description ?? "");
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
