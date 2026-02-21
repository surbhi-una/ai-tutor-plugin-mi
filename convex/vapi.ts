"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const TUTOR_SYSTEM_PROMPT = `You are a friendly, expert AI tutor. The student is studying the following material from their course.

COURSE MATERIAL:
---
{CONTENT}
---

RULES:
- Use the Socratic method: guide with questions before giving answers
- Break complex ideas into small, clear parts
- Use analogies and real-world examples
- Check understanding by asking the student to explain back
- Be encouraging and patient
- Stay focused on the provided material
- Keep responses concise (2-3 sentences for voice)
- Start by greeting the student and asking what they'd like to learn about from this material`;

export const createAssistant = action({
  args: {
    content: v.string(),
    llmProvider: v.optional(v.string()),
    ttsProvider: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) throw new Error("VAPI_API_KEY not configured");

    const systemPrompt = TUTOR_SYSTEM_PROMPT.replace("{CONTENT}", args.content);

    // Build LLM config
    const llmProvider = args.llmProvider ?? "gpt-4o";
    let model: Record<string, unknown>;

    if (llmProvider.startsWith("minimax")) {
      model = {
        provider: "custom-llm",
        model: "MiniMax-Text-01",
        url: "https://api.minimaxi.chat/v1/text/chatcompletion_v2",
        messages: [{ role: "system", content: systemPrompt }],
      };
    } else {
      // OpenAI, Gemini, etc. via VAPI's built-in providers
      const [provider, modelName] = llmProvider.includes("/")
        ? llmProvider.split("/")
        : ["openai", llmProvider];
      model = {
        provider,
        model: modelName,
        messages: [{ role: "system", content: systemPrompt }],
      };
    }

    // Build TTS config
    const ttsProvider = args.ttsProvider ?? "11labs";
    let voice: Record<string, unknown>;

    if (ttsProvider === "minimax") {
      voice = {
        provider: "minimax",
        voiceId: "Wise_Woman",
        model: "speech-02-turbo",
      };
    } else if (ttsProvider === "playht") {
      voice = {
        provider: "playht",
        voiceId: "jennifer",
      };
    } else {
      voice = {
        provider: "11labs",
        voiceId: "sarah",
        model: "eleven_turbo_v2_5",
      };
    }

    const res = await fetch("https://api.vapi.ai/assistant", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "AI Tutor",
        model,
        voice,
        firstMessage:
          "Hi there! I'm your AI tutor. I've reviewed your course material. What would you like to learn about today?",
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en",
        },
        silenceTimeoutSeconds: 30,
        maxDurationSeconds: 600,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VAPI API error ${res.status}: ${text}`);
    }

    const assistant = await res.json();
    return { assistantId: assistant.id };
  },
});
