"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EngineSelector } from "@/components/tutor/engine-selector";
import { VoiceButton } from "@/components/tutor/voice-button";
import { TranscriptView, type TranscriptMessage } from "@/components/tutor/transcript-view";
import { ContentPreview } from "@/components/tutor/content-preview";
import { useVapiSession } from "@/hooks/use-vapi-session";
import { useSpeechmaticsSession } from "@/hooks/use-speechmatics-session";
import Link from "next/link";
import { ArrowLeft, Mic } from "lucide-react";

interface MaterialData {
  title: string;
  content: string;
  courseName: string;
  courseId?: string;
}

function TutorContent() {
  const searchParams = useSearchParams();
  const [material, setMaterial] = useState<MaterialData | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);

  const [engine, setEngine] = useState("vapi");
  const [llmProvider, setLlmProvider] = useState("openai/gpt-4o");
  const [ttsProvider, setTtsProvider] = useState("11labs");

  // Load material from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("studyvoice_material");
      if (raw) {
        setMaterial(JSON.parse(raw));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Callback for voice hooks to add transcript messages
  function onTranscript(role: "user" | "assistant", text: string) {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() },
    ]);
  }

  const vapiSession = useVapiSession(onTranscript);
  const speechmaticsSession = useSpeechmaticsSession(onTranscript);

  const activeSession = engine === "vapi" ? vapiSession : speechmaticsSession;
  const isActive = activeSession.state !== "idle";

  function handleToggle() {
    if (!material) return;

    if (engine === "vapi") {
      if (vapiSession.state === "idle") {
        vapiSession.start(material.content, llmProvider, ttsProvider);
      } else {
        vapiSession.stop();
      }
    } else {
      if (speechmaticsSession.state === "idle") {
        speechmaticsSession.start(material.content);
      } else {
        speechmaticsSession.stop();
      }
    }
  }

  if (!material) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">No material selected</p>
          <Link
            href="/"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Go back and select content
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* Left panel -- settings & content */}
      <aside className="flex w-full flex-col gap-4 border-b border-border p-4 lg:w-80 lg:border-b-0 lg:border-r">
        <ContentPreview
          title={material.title}
          content={material.content}
          courseName={material.courseName}
        />
        <EngineSelector
          engine={engine}
          llmProvider={llmProvider}
          ttsProvider={ttsProvider}
          onEngineChange={setEngine}
          onLlmChange={setLlmProvider}
          onTtsChange={setTtsProvider}
          disabled={isActive}
        />
      </aside>

      {/* Main area -- voice + transcript */}
      <div className="flex flex-1 flex-col">
        {/* Voice control */}
        <div className="flex items-center justify-center border-b border-border py-8">
          <VoiceButton
            state={activeSession.state}
            onToggle={handleToggle}
          />
        </div>

        {/* Transcript */}
        <TranscriptView messages={messages} />
      </div>
    </div>
  );
}

export default function TutorPage() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
            <Mic className="h-3 w-3 text-primary-foreground" />
          </div>
          <span className="text-sm font-medium text-foreground">
            AI Tutor
          </span>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <TutorContent />
      </Suspense>
    </div>
  );
}
