"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

async function canvasFetch(domain: string, token: string, path: string) {
  const url = `https://${domain}/api/v1${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canvas API error ${res.status}: ${text}`);
  }
  return res.json();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export const fetchCourses = action({
  args: {
    domain: v.string(),
    token: v.string(),
  },
  handler: async (_ctx, args) => {
    const courses = await canvasFetch(
      args.domain,
      args.token,
      "/courses?enrollment_type=student&per_page=50&include[]=term"
    );
    return courses.map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name,
      courseCode: c.course_code,
      term: (c.term as Record<string, unknown>)?.name ?? null,
    }));
  },
});

export const fetchModules = action({
  args: {
    domain: v.string(),
    token: v.string(),
    courseId: v.string(),
  },
  handler: async (_ctx, args) => {
    const modules = await canvasFetch(
      args.domain,
      args.token,
      `/courses/${args.courseId}/modules?include[]=items&per_page=50`
    );
    return modules.map((m: Record<string, unknown>) => ({
      id: m.id,
      name: m.name,
      position: m.position,
      items: ((m.items as Record<string, unknown>[]) ?? []).map(
        (item: Record<string, unknown>) => ({
          id: item.id,
          title: item.title,
          type: item.type,
          contentId: item.content_id,
          pageUrl: item.page_url,
        })
      ),
    }));
  },
});

export const fetchContent = action({
  args: {
    domain: v.string(),
    token: v.string(),
    courseId: v.string(),
    itemType: v.string(),
    itemId: v.optional(v.string()),
    pageUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    let html = "";
    let title = "";

    if (args.itemType === "Page" && args.pageUrl) {
      const page = await canvasFetch(
        args.domain,
        args.token,
        `/courses/${args.courseId}/pages/${args.pageUrl}`
      );
      html = page.body ?? "";
      title = page.title ?? "";
    } else if (args.itemType === "Assignment" && args.itemId) {
      const assignment = await canvasFetch(
        args.domain,
        args.token,
        `/courses/${args.courseId}/assignments/${args.itemId}`
      );
      html = assignment.description ?? "";
      title = assignment.name ?? "";
    } else if (args.itemType === "Discussion" && args.itemId) {
      const discussion = await canvasFetch(
        args.domain,
        args.token,
        `/courses/${args.courseId}/discussion_topics/${args.itemId}`
      );
      html = discussion.message ?? "";
      title = discussion.title ?? "";
    } else if (args.itemType === "Quiz" && args.itemId) {
      const quiz = await canvasFetch(
        args.domain,
        args.token,
        `/courses/${args.courseId}/quizzes/${args.itemId}`
      );
      html = quiz.description ?? "";
      title = quiz.title ?? "";
    } else if (args.itemType === "File" && args.itemId) {
      // File content (PDF, text) requires binary fetch + parsing - use web app /api/canvas
      throw new Error(
        "File content is supported in the web app. Please open StudyVoice in your browser to study files."
      );
    } else {
      throw new Error(`Unsupported item type: ${args.itemType}`);
    }

    return {
      title,
      content: stripHtml(html),
      rawHtml: html,
    };
  },
});
