"use client";

import { cn } from "@/lib/utils";
import { Mic, MicOff, Loader2, Phone } from "lucide-react";

export type VoiceState = "idle" | "connecting" | "listening" | "speaking";

interface VoiceButtonProps {
  state: VoiceState;
  onToggle: () => void;
  disabled?: boolean;
}

export function VoiceButton({ state, onToggle, disabled }: VoiceButtonProps) {
  const isActive = state !== "idle";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={onToggle}
        disabled={disabled || state === "connecting"}
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          state === "idle" &&
            "bg-primary text-primary-foreground hover:opacity-90",
          state === "connecting" &&
            "bg-secondary text-muted-foreground",
          state === "listening" &&
            "bg-primary text-primary-foreground",
          state === "speaking" &&
            "bg-primary/80 text-primary-foreground"
        )}
        aria-label={isActive ? "End call" : "Start call"}
      >
        {/* Pulsing ring for active states */}
        {(state === "listening" || state === "speaking") && (
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
        )}

        {state === "idle" && <Mic className="h-8 w-8" />}
        {state === "connecting" && (
          <Loader2 className="h-8 w-8 animate-spin" />
        )}
        {state === "listening" && <Mic className="h-8 w-8" />}
        {state === "speaking" && <Phone className="h-8 w-8" />}
      </button>

      <span className="text-sm text-muted-foreground">
        {state === "idle" && "Tap to start"}
        {state === "connecting" && "Connecting..."}
        {state === "listening" && "Listening..."}
        {state === "speaking" && "Tutor is speaking"}
      </span>

      {isActive && state !== "connecting" && (
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-4 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25 transition-colors"
        >
          <MicOff className="h-3 w-3" />
          End Session
        </button>
      )}
    </div>
  );
}
