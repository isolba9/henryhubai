"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ChatPanel from "@/components/ChatPanel";
import PricePanel from "@/components/PricePanel";
import AuthModal from "@/components/AuthModal";
import { trackEvent } from "@/lib/analytics";

type Model = "claude-opus-4-6" | "claude-sonnet-4-6";

interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
}

export default function Home() {
  const [model, setModel] = useState<Model>("claude-sonnet-4-6");
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    trackEvent("session_start", { referrer: document.referrer });

    // Check if user is already authenticated
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const handleSignOut = async () => {
    trackEvent("sign_out", {}, user?.id);
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null);
  };

  const handleAuthRequired = () => {
    setShowAuthModal(true);
  };

  const handleAuthenticated = (u: AuthUser) => {
    setUser(u);
    setShowAuthModal(false);
    trackEvent("auth_complete", {}, u.id);
  };

  if (!mounted || authLoading) {
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
      {/* Auth Modal Overlay — shown when unauthenticated user tries to chat */}
      {showAuthModal && (
        <AuthModal onAuthenticated={handleAuthenticated} />
      )}

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
            onClick={() => { setModel("claude-opus-4-6"); trackEvent("model_switch", { model: "claude-opus-4-6" }, user?.id); }}
            title="Deep analysis &amp; complex reasoning — best for detailed research, multi-step analysis, and nuanced market insights"
            className={`px-3 py-1 text-[10px] font-semibold tracking-wider transition-all rounded-sm ${
              model === "claude-opus-4-6"
                ? "bg-white/10 text-white glow-border"
                : "text-terminal-muted hover:text-terminal-text"
            }`}
          >
            OPUS 4.6
          </button>
          <button
            onClick={() => { setModel("claude-sonnet-4-6"); trackEvent("model_switch", { model: "claude-sonnet-4-6" }, user?.id); }}
            title="Fast &amp; efficient — best for quick questions, price checks, and simple data lookups"
            className={`px-3 py-1 text-[10px] font-semibold tracking-wider transition-all rounded-sm ${
              model === "claude-sonnet-4-6"
                ? "bg-white/10 text-white glow-border"
                : "text-terminal-muted hover:text-terminal-text"
            }`}
          >
            SONNET 4.6
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3 text-[9px] tracking-wider">
          {user ? (
            <>
              <span className="text-terminal-muted">
                {user.display_name || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-terminal-muted hover:text-white transition-colors uppercase"
              >
                Sign Out
              </button>
              <div className="w-px h-3 bg-terminal-border" />
            </>
          ) : (
            <>
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-terminal-muted hover:text-white transition-colors uppercase"
              >
                Sign In
              </button>
              <div className="w-px h-3 bg-terminal-border" />
            </>
          )}
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-terminal-green pulse-live" />
          <span className="text-terminal-muted uppercase">Live</span>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/2 min-w-0 border-r border-terminal-border">
          <ChatPanel
            model={model}
            userId={user?.id}
            onAuthRequired={handleAuthRequired}
          />
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
        <span>&copy; {new Date().getFullYear()} HENRYHUB.ai is a product of Alconbury Tech Ltd</span>
      </footer>
    </div>
  );
}
