import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    materialId: v.id("materials"),
    engine: v.string(),
    llmProvider: v.optional(v.string()),
    ttsProvider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("sessions", {
      ...args,
      status: "active",
      createdAt: Date.now(),
    });
    return id;
  },
});

export const end = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "ended" });
  },
});

export const getByMaterial = query({
  args: { materialId: v.id("materials") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_material", (q) => q.eq("materialId", args.materialId))
      .order("desc")
      .collect();
  },
});
