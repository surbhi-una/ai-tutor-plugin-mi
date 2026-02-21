"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";

interface TranscriptViewProps {
  sessionId: Id<"sessions"> | null;
}

export function TranscriptView({ sessionId }: TranscriptViewProps) {
  const messages = useQuery(
    api.messages.listBySession,
    sessionId ? { sessionId } : "skip"
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!sessionId) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        Start a voice session to see the transcript
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="flex flex-col gap-3 p-4">
        {messages?.map((msg) => (
          <div
            key={msg._id}
            className={cn(
              "flex gap-2.5 max-w-[85%]",
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {msg.role === "user" ? (
                <User className="h-3.5 w-3.5" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
            </div>
            <div
              className={cn(
                "rounded-xl px-3 py-2 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {(!messages || messages.length === 0) && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Waiting for conversation to begin...
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
