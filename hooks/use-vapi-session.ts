"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { VoiceState } from "@/components/tutor/voice-button";

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

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.reason === "string") return obj.reason;
    const str = JSON.stringify(err);
    if (str !== "{}") return str;
  }
  return "Voice connection failed. Check your API key, microphone permissions, and browser console for details.";
}

export function useVapiSession() {
  const [state, setState] = useState<VoiceState>("idle");
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vapiRef = useRef<ReturnType<typeof import("@vapi-ai/web").default.prototype.constructor> | null>(null);

  const createSession = useMutation(api.sessions.create);
  const endSession = useMutation(api.sessions.end);
  const sendMessage = useMutation(api.messages.send);
  const syncFromConversation = useMutation(api.messages.syncFromConversation);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        try {
          vapiRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const start = useCallback(
    async (
      materialId: Id<"materials">,
      content: string,
      llmProvider: string,
      ttsProvider: string
    ) => {
      setState("connecting");
        setError(null);

      try {
        // Create session in Convex
        const sid = await createSession({
          materialId,
          engine: "vapi",
          llmProvider,
          ttsProvider,
        });
        setSessionId(sid);

        // Dynamically import to avoid SSR issues
        const VapiModule = await import("@vapi-ai/web");
        const Vapi = VapiModule.default;

        const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
        if (!publicKey) {
          throw new Error("NEXT_PUBLIC_VAPI_PUBLIC_KEY is not set");
        }

        const vapi = new Vapi(publicKey);
        vapiRef.current = vapi;

        // Build assistant config
        const systemPrompt = TUTOR_SYSTEM_PROMPT.replace("{CONTENT}", content.slice(0, 15000));

        // Parse LLM provider
        const [provider, modelName] = llmProvider.includes("/")
          ? llmProvider.split("/")
          : ["openai", llmProvider];

        const modelConfig: Record<string, unknown> = {
          provider,
          model: modelName,
          messages: [{ role: "system", content: systemPrompt }],
        };

        // Build voice config with fallback to prevent "Meeting has ended" when TTS times out
        const openaiFallback = { provider: "openai" as const, voiceId: "shimmer" };
        let voiceConfig: Record<string, unknown>;
        if (ttsProvider === "openai") {
          voiceConfig = {
            provider: "openai",
            voiceId: "shimmer",
          };
        } else if (ttsProvider === "minimax") {
          voiceConfig = {
            provider: "minimax",
            voiceId: "Wise_Woman",
            model: "speech-02-turbo",
            fallbackPlan: { voices: [openaiFallback] },
          };
        } else if (ttsProvider === "playht") {
          voiceConfig = {
            provider: "playht",
            voiceId: "jennifer",
            fallbackPlan: { voices: [openaiFallback] },
          };
        } else {
          voiceConfig = {
            provider: "11labs",
            voiceId: "sarah",
            model: "eleven_turbo_v2_5",
            fallbackPlan: { voices: [openaiFallback] },
          };
        }

        // Wire up events
        const firstMessageText =
          "Hi there! I'm your AI tutor. I've reviewed your course material. What would you like to learn about today?";

        vapi.on("call-start", () => {
          setState("listening");
          // Add assistant's first message to transcript so user sees the greeting
          sendMessage({
            sessionId: sid,
            role: "assistant",
            text: firstMessageText,
          });
        });

        vapi.on("call-end", () => {
          setState("idle");
        });

        vapi.on("speech-start", () => {
          setState("speaking");
        });

        vapi.on("speech-end", () => {
          setState("listening");
        });

        vapi.on("message", (msg: Record<string, unknown>) => {
          // Transcript: real-time speech-to-text
          if (msg.type === "transcript") {
            const text =
              (msg.transcript as string) ??
              (msg.message as string) ??
              (typeof msg.content === "string" ? msg.content : null);
            const role = (msg.role as string) ?? "user";
            const isFinal = msg.transcriptType === "final" || msg.transcriptType === undefined;

            if (text && isFinal) {
              sendMessage({
                sessionId: sid,
                role: role === "assistant" || role === "user" ? role : "user",
                text,
              });
            }
            return;
          }

          // Conversation-update: full history (fallback when transcript events are sparse)
          if (msg.type === "conversation-update") {
            const rawMessages = msg.messages as Array<{ role?: string; message?: string }> | undefined;
            if (Array.isArray(rawMessages) && rawMessages.length > 0) {
              const parsed = rawMessages
                .filter((m) => m.message && (m.role === "user" || m.role === "bot" || m.role === "assistant"))
                .map((m) => ({
                  role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
                  text: String(m.message),
                }));
              if (parsed.length > 0) {
                syncFromConversation({ sessionId: sid, messages: parsed });
              }
            }
          }
        });

        vapi.on("error", (err: unknown) => {
          const msg = getErrorMessage(err);
          console.error("[VAPI Error]", err);
          setError(msg);
          setState("idle");
        });

        // Start the call with inline assistant config
        await vapi.start({
          model: modelConfig,
          voice: voiceConfig,
          firstMessage: firstMessageText,
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "en",
          },
        } as Parameters<typeof vapi.start>[0]);
      } catch (err) {
        const msg = getErrorMessage(err);
        console.error("[VAPI Start Error]", err);
        setError(msg);
        setState("idle");
      }
    },
    [createSession, sendMessage, syncFromConversation]
  );

  const stop = useCallback(async () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      vapiRef.current = null;
    }
    if (sessionId) {
      await endSession({ id: sessionId });
    }
    setState("idle");
    setSessionId(null);
  }, [sessionId, endSession]);

  return { state, sessionId, error, start, stop };
}
