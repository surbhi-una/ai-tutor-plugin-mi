import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  canvasConnections: defineTable({
    domain: v.string(),
    token: v.string(),
    createdAt: v.number(),
  }),

  materials: defineTable({
    content: v.string(),
    source: v.string(), // "canvas" | "gcl" | "paste"
    title: v.optional(v.string()),
    courseId: v.optional(v.string()),
    courseName: v.optional(v.string()),
    canvasConnectionId: v.optional(v.id("canvasConnections")),
    createdAt: v.number(),
  }),

  sessions: defineTable({
    materialId: v.id("materials"),
    engine: v.string(), // "vapi" | "speechmatics"
    llmProvider: v.optional(v.string()),
    ttsProvider: v.optional(v.string()),
    status: v.string(), // "active" | "ended"
    createdAt: v.number(),
  }).index("by_material", ["materialId"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.string(), // "user" | "assistant" | "system"
    text: v.string(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),
});
