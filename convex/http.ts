import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Chrome extension calls this to trigger content fetch + material creation
http.route({
  path: "/api/connect-canvas",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { domain, token, courseId, itemType, itemId, pageUrl } = body;

    if (!domain || !token || !courseId) {
      return new Response(
        JSON.stringify({ error: "Missing domain, token, or courseId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      // Save connection
      const connectionId = await ctx.runMutation(
        api.canvasConnections.save,
        { domain, token }
      );

      // Fetch content from Canvas
      const result = await ctx.runAction(api.canvas.fetchContent, {
        domain,
        token,
        courseId: String(courseId),
        itemType: itemType ?? "Page",
        itemId: itemId ? String(itemId) : undefined,
        pageUrl: pageUrl ?? undefined,
      });

      // Store as material
      const materialId = await ctx.runMutation(api.materials.create, {
        content: result.content,
        source: "canvas",
        title: result.title,
        courseId: String(courseId),
        canvasConnectionId: connectionId,
      });

      return new Response(
        JSON.stringify({ materialId, title: result.title }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }),
});

// CORS preflight
http.route({
  path: "/api/connect-canvas",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;
