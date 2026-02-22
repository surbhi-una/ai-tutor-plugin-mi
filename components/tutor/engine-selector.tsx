"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EngineSelectorProps {
  engine: string;
  llmProvider: string;
  ttsProvider: string;
  onEngineChange: (engine: string) => void;
  onLlmChange: (llm: string) => void;
  onTtsChange: (tts: string) => void;
  disabled?: boolean;
}

export function EngineSelector({
  engine,
  llmProvider,
  ttsProvider,
  onEngineChange,
  onLlmChange,
  onTtsChange,
  disabled,
}: EngineSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Voice Engine</Label>
        <Select value={engine} onValueChange={onEngineChange} disabled={disabled}>
          <SelectTrigger className="bg-secondary text-secondary-foreground h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vapi">VAPI</SelectItem>
            <SelectItem value="speechmatics">Speechmatics Flow</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {engine === "vapi" && (
        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <Label className="text-xs text-muted-foreground">LLM</Label>
            <Select value={llmProvider} onValueChange={onLlmChange} disabled={disabled}>
              <SelectTrigger className="bg-secondary text-secondary-foreground h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="openai/gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="google/gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <Label className="text-xs text-muted-foreground">TTS</Label>
            <Select value={ttsProvider} onValueChange={onTtsChange} disabled={disabled}>
              <SelectTrigger className="bg-secondary text-secondary-foreground h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (recommended)</SelectItem>
                <SelectItem value="11labs">ElevenLabs</SelectItem>
                <SelectItem value="minimax">MiniMax Speech-02</SelectItem>
                <SelectItem value="playht">PlayHT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
