import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const syncFromConversation = mutation({
  args: {
    sessionId: v.id("sessions"),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        text: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const msg of existing) {
      await ctx.db.delete(msg._id);
    }
    const now = Date.now();
    for (let i = 0; i < args.messages.length; i++) {
      await ctx.db.insert("messages", {
        sessionId: args.sessionId,
        role: args.messages[i].role,
        text: args.messages[i].text,
        createdAt: now + i,
      });
    }
  },
});

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});
