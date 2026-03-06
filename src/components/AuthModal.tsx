"use client";

import { useState } from "react";
import Image from "next/image";

interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
}

interface Props {
  onAuthenticated: (user: AuthUser) => void;
}

export default function AuthModal({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
      const body: Record<string, string> = { email: email.trim(), password };
      if (mode === "signup" && displayName.trim()) {
        body.displayName = displayName.trim();
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed");
        return;
      }

      onAuthenticated(data.user);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError("");
    setConfirmPassword("");
    setDisplayName("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a]">
      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px)",
        }}
      />

      <div className="relative w-full max-w-[380px] mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.svg"
            alt="HENRYHUB.ai"
            width={200}
            height={50}
            priority
          />
          <p className="mt-3 text-[11px] text-terminal-muted tracking-wider">
            AI dedicated to Natural Gas
          </p>
        </div>

        {/* Auth Card */}
        <div className="border border-terminal-border bg-[#0d0d0d] rounded-sm">
          {/* Tabs */}
          <div className="flex border-b border-terminal-border">
            <button
              onClick={() => switchMode()}
              className={`flex-1 py-2.5 text-[10px] font-semibold tracking-[0.2em] uppercase transition-all ${
                mode === "signin"
                  ? "text-white border-b border-white bg-white/[0.03]"
                  : "text-terminal-muted hover:text-white/60"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode()}
              className={`flex-1 py-2.5 text-[10px] font-semibold tracking-[0.2em] uppercase transition-all ${
                mode === "signup"
                  ? "text-white border-b border-white bg-white/[0.03]"
                  : "text-terminal-muted hover:text-white/60"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-[9px] text-terminal-muted tracking-[0.2em] uppercase mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-[#0a0a0a] border border-terminal-border text-[12px] text-terminal-text px-3 py-2 rounded-sm outline-none focus:border-white/40 transition-colors font-mono placeholder:text-terminal-muted/40"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="block text-[9px] text-terminal-muted tracking-[0.2em] uppercase mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="w-full bg-[#0a0a0a] border border-terminal-border text-[12px] text-terminal-text px-3 py-2 rounded-sm outline-none focus:border-white/40 transition-colors font-mono placeholder:text-terminal-muted/40"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[9px] text-terminal-muted tracking-[0.2em] uppercase mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Min 6 characters" : "Enter password"}
                required
                className="w-full bg-[#0a0a0a] border border-terminal-border text-[12px] text-terminal-text px-3 py-2 rounded-sm outline-none focus:border-white/40 transition-colors font-mono placeholder:text-terminal-muted/40"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-[9px] text-terminal-muted tracking-[0.2em] uppercase mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                  className="w-full bg-[#0a0a0a] border border-terminal-border text-[12px] text-terminal-text px-3 py-2 rounded-sm outline-none focus:border-white/40 transition-colors font-mono placeholder:text-terminal-muted/40"
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && (
              <div className="text-[11px] text-[#ff4444] bg-[#ff4444]/10 border border-[#ff4444]/20 rounded-sm px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-terminal py-2.5 text-[11px] tracking-[0.15em]"
            >
              {loading ? (
                <span>
                  Authenticating<span className="cursor-blink">_</span>
                </span>
              ) : mode === "signin" ? (
                "SIGN IN"
              ) : (
                "CREATE ACCOUNT"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[9px] text-terminal-muted tracking-wider">
          &copy; {new Date().getFullYear()} HENRYHUB.ai is a product of
          Alconbury Tech Ltd
        </p>
      </div>
    </div>
  );
}
