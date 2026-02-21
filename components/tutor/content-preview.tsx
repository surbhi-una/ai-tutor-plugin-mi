"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";

interface ContentPreviewProps {
  title?: string;
  content: string;
  courseName?: string;
}

export function ContentPreview({ title, content, courseName }: ContentPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-secondary/50 transition-colors rounded-lg"
      >
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-sm font-medium text-card-foreground truncate">
            {title || "Course Material"}
          </span>
          {courseName && (
            <span className="text-xs text-muted-foreground truncate">
              {courseName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-xs">
            {content.length > 1000
              ? `${Math.round(content.length / 1000)}k chars`
              : `${content.length} chars`}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <ScrollArea className="h-48">
            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {content}
            </p>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
