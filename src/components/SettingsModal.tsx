"use client";

import { useState, useEffect } from "react";

export interface Settings {
  anthropicKey: string;
  apiNinjasKey: string;
  eiaKey: string;
  supabaseUrl: string;
  supabaseKey: string;
}

const STORAGE_KEY = "henryhub_settings";

const SETUP_SQL = `-- Run this in your Supabase SQL Editor to create the price_history table

CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price DECIMAL(10,4) NOT NULL,
  name TEXT,
  exchange TEXT,
  updated BIGINT
);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert"
  ON price_history FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous select"
  ON price_history FOR SELECT TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_price_history_timestamp
  ON price_history(timestamp DESC);`;

export function loadSettings(): Settings {
  if (typeof window === "undefined")
    return {
      anthropicKey: "",
      apiNinjasKey: "",
      eiaKey: "",
      supabaseUrl: "",
      supabaseKey: "",
    };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no settings");
    return JSON.parse(raw);
  } catch {
    return {
      anthropicKey: "",
      apiNinjasKey: "",
      eiaKey: "",
      supabaseUrl: "",
      supabaseKey: "",
    };
  }
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface Props {
  onClose: () => void;
  onSave: (settings: Settings) => void;
  current: Settings;
}

export default function SettingsModal({ onClose, onSave, current }: Props) {
  const [form, setForm] = useState<Settings>(current);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSave = () => {
    saveSettings(form);
    onSave(form);
    onClose();
  };

  const copySql = () => {
    navigator.clipboard.writeText(SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const field = (
    label: string,
    key: keyof Settings,
    placeholder: string,
    isPassword = true
  ) => (
    <div className="mb-4">
      <label className="block text-[10px] font-semibold tracking-[0.15em] uppercase text-terminal-green mb-1.5">
        {label}
      </label>
      <input
        type={isPassword ? "password" : "text"}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full"
        autoComplete="off"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <div
        className="terminal-panel glow-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="terminal-panel-header justify-between">
          <span>Settings — API Keys</span>
          <button
            onClick={onClose}
            className="text-terminal-muted hover:text-terminal-red transition-colors text-sm"
          >
            [ESC]
          </button>
        </div>

        <div className="p-5">
          <p className="text-[11px] text-terminal-muted mb-5 leading-relaxed">
            All keys are stored locally in your browser. They are sent only to
            the server-side API routes of this application and never exposed in
            frontend code.
          </p>

          {field("Anthropic API Key", "anthropicKey", "sk-ant-...")}
          {field("API Ninjas API Key", "apiNinjasKey", "Your API Ninjas key")}
          {field("EIA API Key", "eiaKey", "Your EIA API key")}

          <div className="border-t border-terminal-border my-5 pt-4">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-terminal-green mb-3">
              Supabase Database
            </p>
            {field(
              "Supabase URL",
              "supabaseUrl",
              "https://your-project.supabase.co",
              false
            )}
            {field("Supabase Anon Key", "supabaseKey", "eyJ...")}
          </div>

          {/* Database Setup */}
          <div className="border-t border-terminal-border pt-4 mb-5">
            <button
              onClick={() => setShowSql(!showSql)}
              className="btn-terminal text-[10px] mb-3"
            >
              {showSql ? "Hide" : "Show"} Database Setup SQL
            </button>

            {showSql && (
              <div className="relative">
                <pre className="bg-black/50 border border-terminal-border p-3 text-[10px] text-terminal-text overflow-x-auto rounded max-h-60 overflow-y-auto leading-relaxed">
                  {SETUP_SQL}
                </pre>
                <button
                  onClick={copySql}
                  className="absolute top-2 right-2 btn-terminal text-[9px] px-2 py-1"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="btn-terminal text-terminal-muted border-terminal-muted hover:text-terminal-text hover:border-terminal-text"
            >
              Cancel
            </button>
            <button onClick={handleSave} className="btn-terminal">
              Save &amp; Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
