"use client";

import { useAuiState } from "@assistant-ui/react";

import { DynamicUIRenderer } from "@/components/dynamic-ui";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { useChatAction } from "@/lib/chat-actions";

const HAS_BLOCK_MARKER = /\[(?:BLOCK|CARD):\w+\]|\[SUGGESTIONS\]/;

/**
 * Replaces assistant-ui's default MarkdownText for the "text" message-part
 * case. The agent sometimes embeds [BLOCK:type]{json}[/BLOCK] markers (task
 * lists, stats, charts, forms, ...) inside its plain-text answer — richer
 * than anything assistant-ui renders out of the box — so when present, this
 * routes the text through the existing DynamicUIRenderer/parseBlocks
 * pipeline instead. Plain prose (the common case) renders through
 * assistant-ui's own MarkdownText, which gets full GFM + mermaid diagrams.
 * Reasoning and tool calls no longer arrive this way; they're real AI SDK
 * message parts now, rendered natively by Thread.
 */
export function FelloText() {
  const text = useAuiState((s) => (s.part.type === "text" ? s.part.text : ""));
  const onAction = useChatAction();
  if (!HAS_BLOCK_MARKER.test(text)) return <MarkdownText />;
  return <DynamicUIRenderer content={text} onAction={onAction} />;
}
