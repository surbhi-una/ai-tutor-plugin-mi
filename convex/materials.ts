import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    content: v.string(),
    source: v.string(),
    title: v.optional(v.string()),
    courseId: v.optional(v.string()),
    courseName: v.optional(v.string()),
    canvasConnectionId: v.optional(v.id("canvasConnections")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("materials", {
      ...args,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const getById = query({
  args: { id: v.id("materials") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
