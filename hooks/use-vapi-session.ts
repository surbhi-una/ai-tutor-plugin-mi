"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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

type OnTranscript = (role: "user" | "assistant", text: string) => void;

export function useVapiSession(onTranscript: OnTranscript) {
  const [state, setState] = useState<VoiceState>("idle");
  const vapiRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

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
    async (content: string, llmProvider: string, ttsProvider: string) => {
      setState("connecting");

      try {
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
        const systemPrompt = TUTOR_SYSTEM_PROMPT.replace(
          "{CONTENT}",
          content.slice(0, 15000)
        );

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
          if (
            msg.type === "transcript" &&
            msg.transcriptType === "final" &&
            msg.transcript
          ) {
            const role = (msg.role as string) === "assistant" ? "assistant" : "user";
            onTranscriptRef.current(role, msg.transcript as string);
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
        } as any);
      } catch (err) {
        console.error("[VAPI Start Error]", err);
        setState("idle");
      }
    },
    []
  );

  const stop = useCallback(async () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      vapiRef.current = null;
    }
    setState("idle");
  }, []);

  return { state, start, stop };
}
