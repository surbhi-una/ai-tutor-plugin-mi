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

export function useVapiSession() {
  const [state, setState] = useState<VoiceState>("idle");
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const vapiRef = useRef<ReturnType<typeof import("@vapi-ai/web").default.prototype.constructor> | null>(null);

  const createSession = useMutation(api.sessions.create);
  const endSession = useMutation(api.sessions.end);
  const sendMessage = useMutation(api.messages.send);

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

        // Build voice config
        let voiceConfig: Record<string, unknown>;
        if (ttsProvider === "minimax") {
          voiceConfig = {
            provider: "minimax",
            voiceId: "Wise_Woman",
            model: "speech-02-turbo",
          };
        } else if (ttsProvider === "playht") {
          voiceConfig = {
            provider: "playht",
            voiceId: "jennifer",
          };
        } else {
          voiceConfig = {
            provider: "11labs",
            voiceId: "sarah",
            model: "eleven_turbo_v2_5",
          };
        }

        // Wire up events
        vapi.on("call-start", () => {
          setState("listening");
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
          // Log transcript messages to Convex
          if (msg.type === "transcript" && msg.transcriptType === "final" && msg.transcript) {
            sendMessage({
              sessionId: sid,
              role: msg.role as string ?? "user",
              text: msg.transcript as string,
            });
          }
        });

        vapi.on("error", (err: unknown) => {
          console.error("[VAPI Error]", err);
          setState("idle");
        });

        // Start the call with inline assistant config
        await vapi.start({
          model: modelConfig,
          voice: voiceConfig,
          firstMessage:
            "Hi there! I'm your AI tutor. I've reviewed your course material. What would you like to learn about today?",
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "en",
          },
        } as Parameters<typeof vapi.start>[0]);
      } catch (err) {
        console.error("[VAPI Start Error]", err);
        setState("idle");
      }
    },
    [createSession, sendMessage]
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

  return { state, sessionId, start, stop };
}
