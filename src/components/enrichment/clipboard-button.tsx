"use client";

import { useState } from "react";
import { Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClipboardButtonProps {
  context: string;
  mode?: "quick" | "session";
  label?: string;
  size?: "sm" | "icon";
}

export function ClipboardButton({
  context,
  mode = "quick",
  label,
  size = "icon",
}: ClipboardButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const fullContext = `${context}\n---\nMode: ${mode}`;
    await navigator.clipboard.writeText(fullContext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (size === "sm") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        title="Copy to clipboard for Claude enrichment"
        className="gap-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        <span className="text-xs">{copied ? "Copied!" : label || "Ask Claude"}</span>
      </Button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard for Claude enrichment"
      className="text-purple-400 hover:text-purple-600 transition-colors"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
