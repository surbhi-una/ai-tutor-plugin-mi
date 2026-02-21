import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = mutation({
  args: {
    domain: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("canvasConnections", {
      domain: args.domain.replace(/\/+$/, ""), // strip trailing slash
      token: args.token,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const get = query({
  args: { id: v.id("canvasConnections") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.db.query("canvasConnections").order("desc").first();
    return connections;
  },
});
