"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { VoiceState } from "@/components/tutor/voice-button";

type OnTranscript = (role: "user" | "assistant", text: string) => void;

export function useSpeechmaticsSession(onTranscript: OnTranscript) {
  const [state, setState] = useState<VoiceState>("idle");
  const flowClientRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  function cleanup() {
    if (flowClientRef.current) {
      try {
        flowClientRef.current.endConversation();
      } catch {
        // ignore
      }
      flowClientRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }

  const start = useCallback(async (content: string) => {
    setState("connecting");

    try {
      // Get JWT from our API route
      const jwtRes = await fetch("/api/speechmatics", {
        method: "POST",
      });
      const jwtData = await jwtRes.json();
      if (!jwtRes.ok || !jwtData.jwt) {
        throw new Error(jwtData.error || "Failed to get Speechmatics JWT");
      }

      // Dynamically import
      const { FlowClient } = await import("@speechmatics/flow-client");

      const flowClient = new FlowClient(
        "wss://flow.api.speechmatics.com",
        { appId: "studyvoice" }
      );
      flowClientRef.current = flowClient;

      // Listen for transcripts
      flowClient.addEventListener("transcript" as string, ((e: CustomEvent) => {
        const data = e.detail;
        if (data?.metadata?.transcript) {
          onTranscriptRef.current("user", data.metadata.transcript);
        }
      }) as EventListener);

      // Listen for agent responses
      flowClient.addEventListener("agentTranscript" as string, ((e: CustomEvent) => {
        const data = e.detail;
        if (data?.metadata?.transcript) {
          onTranscriptRef.current("assistant", data.metadata.transcript);
        }
      }) as EventListener);

      // Audio playback
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      flowClient.addEventListener("agentAudio" as string, ((e: CustomEvent) => {
        const audioData = e.detail?.data;
        if (audioData && audioContext.state === "running") {
          const float32 = new Float32Array(audioData.length / 2);
          const view = new DataView(audioData.buffer);
          for (let i = 0; i < float32.length; i++) {
            float32[i] = view.getInt16(i * 2, true) / 32768;
          }
          const buffer = audioContext.createBuffer(1, float32.length, 16000);
          buffer.copyToChannel(float32, 0);
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContext.destination);
          source.start();
        }
      }) as EventListener);

      // Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      mediaStreamRef.current = stream;

      // Start conversation
      flowClient.startConversation(jwtData.jwt, {
        config: {
          template_id: "flow-service-assistant-amelia",
          template_variables: {
            persona:
              "You are a friendly AI tutor. Help the student understand the following course material using the Socratic method. Keep responses concise. Material: " +
              content.slice(0, 5000),
          },
        },
        audio_format: {
          type: "raw",
          encoding: "pcm_s16le",
          sample_rate: 16000,
        },
      });

      // Send mic audio to Flow
      const micSource = audioContext.createMediaStreamSource(stream);
      await audioContext.audioWorklet.addModule(
        URL.createObjectURL(
          new Blob(
            [
              `class PCMProcessor extends AudioWorkletProcessor {
                process(inputs) {
                  const input = inputs[0]?.[0];
                  if (input) {
                    const int16 = new Int16Array(input.length);
                    for (let i = 0; i < input.length; i++) {
                      int16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)));
                    }
                    this.port.postMessage(int16.buffer, [int16.buffer]);
                  }
                  return true;
                }
              }
              registerProcessor('pcm-processor', PCMProcessor);`,
            ],
            { type: "application/javascript" }
          )
        )
      );
      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      workletNode.port.onmessage = (e) => {
        if (flowClientRef.current) {
          flowClientRef.current.sendAudio(new Uint8Array(e.data));
        }
      };
      micSource.connect(workletNode);
      workletNode.connect(audioContext.destination);

      setState("listening");
    } catch (err) {
      console.error("[Speechmatics Start Error]", err);
      setState("idle");
      cleanup();
    }
  }, []);

  const stop = useCallback(async () => {
    cleanup();
    setState("idle");
  }, []);

  return { state, start, stop };
}
