"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ChatPanel from "@/components/ChatPanel";
import PricePanel from "@/components/PricePanel";

type Model = "claude-opus-4-6" | "claude-sonnet-4-6";

export default function Home() {
  const [model, setModel] = useState<Model>("claude-sonnet-4-6");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-white text-sm">
          Initializing terminal<span className="cursor-blink">_</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col noise-bg">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-2 border-b border-terminal-border bg-[#0a0a0a] relative z-10">
        <div className="shrink-0">
          <Image
            src="/logo.svg"
            alt="HENRYHUB.ai"
            width={170}
            height={45}
            priority
          />
        </div>

        <div className="w-px h-6 bg-terminal-border" />

        {/* Model Toggle */}
        <div className="flex items-center gap-1 bg-black/50 border border-terminal-border rounded-sm p-0.5">
          <button
            onClick={() => setModel("claude-opus-4-6")}
            className={`px-3 py-1 text-[10px] font-semibold tracking-wider transition-all rounded-sm ${
              model === "claude-opus-4-6"
                ? "bg-white/10 text-white glow-border"
                : "text-terminal-muted hover:text-terminal-text"
            }`}
          >
            OPUS 4.6
          </button>
          <button
            onClick={() => setModel("claude-sonnet-4-6")}
            className={`px-3 py-1 text-[10px] font-semibold tracking-wider transition-all rounded-sm ${
              model === "claude-sonnet-4-6"
                ? "bg-white/10 text-white glow-border"
                : "text-terminal-muted hover:text-terminal-text"
            }`}
          >
            SONNET 4.6
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 text-[9px] tracking-wider">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-green pulse-live" />
          <span className="text-terminal-muted uppercase">Live</span>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/2 min-w-0 border-r border-terminal-border">
          <ChatPanel model={model} />
        </div>
        <div className="w-1/2 min-w-0">
          <PricePanel />
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-1 border-t border-terminal-border flex items-center justify-between text-[9px] text-terminal-muted bg-[#0a0a0a] relative z-10">
        <span>
          HENRYHUB.ai Terminal — Model:{" "}
          <span className="text-white">
            {model === "claude-opus-4-6" ? "Opus 4.6" : "Sonnet 4.6"}
          </span>
        </span>
        <span>Powered by API Ninjas &amp; EIA</span>
      </footer>
    </div>
  );
}
