"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  downloadData?: Record<string, unknown>[] | null;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  model: "claude-opus-4-6" | "claude-sonnet-4-6";
  userId?: string;
  onAuthRequired?: () => void;
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

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const WELCOME: ChatMessage = {
  role: "system",
  content:
    "HENRYHUB.ai Terminal v1.0 — Connected\nSpecializing in Henry Hub natural gas prices and fundamentals.\nType a message to begin.",
  timestamp: new Date().toISOString(),
};

export default function ChatPanel({ model, userId, onAuthRequired }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* ── Load conversations list ── */
  const loadConversations = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      /* ignore */
    }
  }, [userId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /* ── Load a conversation's messages ── */
  const loadConversation = async (conv: Conversation) => {
    setHistoryLoading(true);
    setActiveConversationId(conv.id);
    setShowHistory(false);

    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        const loaded: ChatMessage[] = [
          {
            ...WELCOME,
            content: `HENRYHUB.ai Terminal v1.0 — Connected\nConversation: ${conv.title}`,
          },
          ...(data.messages || []).map(
            (m: { role: string; content: string; created_at: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              timestamp: m.created_at,
            })
          ),
        ];
        setMessages(loaded);
      }
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
      inputRef.current?.focus();
    }
  };

  /* ── Start new conversation ── */
  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([WELCOME]);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  /* ── Delete conversation ── */
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          startNewChat();
        }
      }
    } catch {
      /* ignore */
    }
  };

  /* ── Send message ── */
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Gate: require auth before first prompt
    if (!userId) {
      onAuthRequired?.();
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          model,
          conversationId: activeConversationId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Service error: ${res.status}`);
      }

      // Update active conversation ID (set on first message of new conversation)
      if (data.conversationId && !activeConversationId) {
        setActiveConversationId(data.conversationId);
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.content,
        timestamp: new Date().toISOString(),
        downloadData: data.downloadData,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Refresh conversations list
      loadConversations();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `ERROR: ${err instanceof Error ? err.message : "Service unavailable"}`,
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
    <div className="terminal-panel flex flex-col h-full relative">
      {/* Panel Header */}
      <div className="terminal-panel-header">
        {userId && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 hover:text-white/80 transition-colors"
            title="Chat history"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <span className="inline-block w-2 h-2 rounded-full bg-terminal-green pulse-live" />
        <span>Chat</span>
        {userId && (
          <button
            onClick={startNewChat}
            className="ml-2 text-[9px] text-terminal-muted hover:text-white transition-colors tracking-wider"
            title="New conversation"
          >
            + NEW
          </button>
        )}
        <span className="ml-auto text-terminal-muted font-normal text-[9px]">
          {model === "claude-opus-4-6" ? "OPUS 4.6" : "SONNET 4.6"}
        </span>
      </div>

      {/* History Sidebar (overlay) */}
      {showHistory && (
        <div className="absolute inset-0 top-[33px] z-20 flex">
          <div className="w-[240px] bg-[#0d0d0d] border-r border-terminal-border flex flex-col h-full animate-fade-in">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border">
              <span className="text-[9px] text-terminal-muted tracking-[0.2em] uppercase font-semibold">
                History
              </span>
              <button
                onClick={() => setShowHistory(false)}
                className="text-terminal-muted hover:text-white text-[14px] transition-colors"
              >
                &times;
              </button>
            </div>

            {/* New Chat Button */}
            <button
              onClick={startNewChat}
              className="mx-3 mt-2 mb-1 btn-terminal text-[9px] py-1.5"
            >
              + NEW CHAT
            </button>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-1 py-1">
              {conversations.length === 0 ? (
                <div className="px-3 py-4 text-[10px] text-terminal-muted text-center">
                  No conversations yet
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    className={`w-full text-left px-3 py-2 rounded-sm mb-0.5 group transition-all ${
                      conv.id === activeConversationId
                        ? "bg-white/[0.06] text-white"
                        : "text-terminal-muted hover:bg-white/[0.03] hover:text-terminal-text"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] leading-tight truncate block flex-1">
                        {conv.title}
                      </span>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="shrink-0 text-[12px] opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity text-terminal-muted hover:text-[#ff4444]"
                        title="Delete"
                      >
                        &times;
                      </button>
                    </div>
                    <span className="text-[9px] text-terminal-muted/60 mt-0.5 block">
                      {timeAgo(conv.updated_at)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Click-away backdrop */}
          <div
            className="flex-1 bg-black/40"
            onClick={() => setShowHistory(false)}
          />
        </div>
      )}

      {/* Loading overlay for conversation switch */}
      {historyLoading && (
        <div className="absolute inset-0 top-[33px] z-10 flex items-center justify-center bg-[#0d0d0d]/80">
          <span className="text-[12px] text-white">
            Loading<span className="cursor-blink">_</span>
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className="animate-fade-in">
            {msg.role === "system" ? (
              <div className="text-[11px] text-white/70 leading-relaxed whitespace-pre-wrap font-medium">
                {msg.content}
              </div>
            ) : msg.role === "user" ? (
              <div className="flex gap-2 text-[12px]">
                <span className="text-white font-bold shrink-0">
                  {">"}
                </span>
                <span className="text-terminal-text whitespace-pre-wrap break-words">
                  {msg.content}
                </span>
              </div>
            ) : (
              <div className="pl-3 border-l border-white/20">
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
          <div className="pl-3 border-l border-white/20 animate-fade-in">
            <div className="text-[10px] text-terminal-muted mb-1">
              HENRY_HUB_AI
            </div>
            <span className="text-white text-[12px]">
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
          <span className="text-white font-bold text-sm shrink-0 pb-1.5">
            {">"}
          </span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Henry Hub natural gas..."
            disabled={loading}
            className="flex-1 bg-transparent border-none outline-none text-terminal-text text-[12px] font-mono resize-none min-h-[20px] max-h-[120px] placeholder:text-terminal-muted/50"
            rows={1}
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="btn-terminal text-[10px] px-3 py-1 shrink-0"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
