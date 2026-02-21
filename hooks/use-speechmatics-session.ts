"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { VoiceState } from "@/components/tutor/voice-button";

export function useSpeechmaticsSession() {
  const [state, setState] = useState<VoiceState>("idle");
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const flowClientRef = useRef<InstanceType<typeof import("@speechmatics/flow-client").FlowClient> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const createSession = useMutation(api.sessions.create);
  const endSessionMutation = useMutation(api.sessions.end);
  const sendMessage = useMutation(api.messages.send);
  const getJwt = useAction(api.speechmatics.getJwt);

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
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }

  const start = useCallback(
    async (materialId: Id<"materials">, content: string) => {
      setState("connecting");

      try {
        // Create session
        const sid = await createSession({
          materialId,
          engine: "speechmatics",
        });
        setSessionId(sid);

        // Get JWT
        const { jwt } = await getJwt();

        // Dynamically import
        const { FlowClient } = await import("@speechmatics/flow-client");

        const flowClient = new FlowClient("wss://flow.api.speechmatics.com", {
          appId: "studyvoice",
        });
        flowClientRef.current = flowClient;

        // Listen for transcripts
        flowClient.addEventListener("transcript" as string, ((e: CustomEvent) => {
          const data = e.detail;
          if (data?.metadata?.transcript) {
            sendMessage({
              sessionId: sid,
              role: "user",
              text: data.metadata.transcript,
            });
          }
        }) as EventListener);

        // Listen for agent responses
        flowClient.addEventListener("agentTranscript" as string, ((e: CustomEvent) => {
          const data = e.detail;
          if (data?.metadata?.transcript) {
            sendMessage({
              sessionId: sid,
              role: "assistant",
              text: data.metadata.transcript,
            });
          }
        }) as EventListener);

        // Listen for audio to play
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        flowClient.addEventListener("agentAudio" as string, ((e: CustomEvent) => {
          const audioData = e.detail?.data;
          if (audioData && audioContext.state === "running") {
            // Play PCM16 audio
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

        // Start conversation with tutor persona
        flowClient.startConversation(jwt, {
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
        workletNodeRef.current = workletNode;

        setState("listening");
      } catch (err) {
        console.error("[Speechmatics Start Error]", err);
        setState("idle");
        cleanup();
      }
    },
    [createSession, sendMessage, getJwt]
  );

  const stop = useCallback(async () => {
    cleanup();
    if (sessionId) {
      await endSessionMutation({ id: sessionId });
    }
    setState("idle");
    setSessionId(null);
  }, [sessionId, endSessionMutation]);

  return { state, sessionId, start, stop };
}
