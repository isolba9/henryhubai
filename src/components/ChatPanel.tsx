"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Settings } from "./SettingsModal";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  downloadData?: Record<string, unknown>[] | null;
}

interface Props {
  settings: Settings;
  model: "claude-opus-4-6" | "claude-sonnet-4-6";
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      const str = val === null || val === undefined ? "" : String(val);
      return str.includes(",") || str.includes('"')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    })
  );
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ChatPanel({ settings, model }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "system",
      content:
        "HENRYHUB.ai Terminal v1.0 — Connected\nSpecializing in Henry Hub natural gas prices and fundamentals.\nType a message to begin.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!settings.anthropicKey) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content:
            "ERROR: Anthropic API key not configured. Open Settings to enter your key.",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build messages for API (exclude system messages from UI)
      const apiMessages = [...messages, userMsg]
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          model,
          anthropicKey: settings.anthropicKey,
          supabaseUrl: settings.supabaseUrl,
          supabaseKey: settings.supabaseKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `API error: ${res.status}`);
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.content,
        timestamp: new Date().toISOString(),
        downloadData: data.downloadData,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `ERROR: ${err instanceof Error ? err.message : "Unknown error"}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="terminal-panel flex flex-col h-full">
      {/* Panel Header */}
      <div className="terminal-panel-header">
        <span className="inline-block w-2 h-2 rounded-full bg-terminal-green pulse-live" />
        <span>Chat</span>
        <span className="ml-auto text-terminal-muted font-normal text-[9px]">
          {model === "claude-opus-4-6" ? "OPUS 4.6" : "SONNET 4.6"}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className="animate-fade-in">
            {msg.role === "system" ? (
              <div className="text-[11px] text-terminal-green/70 leading-relaxed whitespace-pre-wrap font-medium">
                {msg.content}
              </div>
            ) : msg.role === "user" ? (
              <div className="flex gap-2 text-[12px]">
                <span className="text-terminal-green font-bold shrink-0">
                  {">"}
                </span>
                <span className="text-terminal-text whitespace-pre-wrap break-words">
                  {msg.content}
                </span>
              </div>
            ) : (
              <div className="pl-3 border-l border-terminal-green/20">
                <div className="text-[10px] text-terminal-muted mb-1">
                  HENRY_HUB_AI
                </div>
                <div className="text-[12px] text-terminal-text leading-relaxed whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
                {msg.downloadData && msg.downloadData.length > 0 && (
                  <button
                    onClick={() =>
                      downloadCSV(
                        msg.downloadData!,
                        `henryhub_prices_${new Date().toISOString().split("T")[0]}.csv`
                      )
                    }
                    className="btn-terminal mt-2 text-[10px]"
                  >
                    Download CSV ({msg.downloadData.length} records)
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="pl-3 border-l border-terminal-green/20 animate-fade-in">
            <div className="text-[10px] text-terminal-muted mb-1">
              HENRY_HUB_AI
            </div>
            <span className="text-terminal-green text-[12px]">
              Processing
              <span className="cursor-blink">_</span>
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-terminal-border p-3">
        <div className="flex gap-2 items-end">
          <span className="text-terminal-green font-bold text-sm shrink-0 pb-1.5">
            {">"}
          </span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              settings.anthropicKey
                ? "Ask about Henry Hub natural gas..."
                : "Configure API keys in Settings first"
            }
            disabled={loading || !settings.anthropicKey}
            className="flex-1 bg-transparent border-none outline-none text-terminal-text text-[12px] font-mono resize-none min-h-[20px] max-h-[120px] placeholder:text-terminal-muted/50"
            rows={1}
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || !settings.anthropicKey}
            className="btn-terminal text-[10px] px-3 py-1 shrink-0"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
