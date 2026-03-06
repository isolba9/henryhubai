import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#0a0a0a",
          panel: "#0d0d0d",
          green: "#00ff88",
          "green-dim": "rgba(0,255,136,0.25)",
          text: "#e0e0e0",
          muted: "#666666",
          border: "#1a1a2e",
          red: "#ff4444",
          amber: "#ffaa00",
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
