import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sentiment Monitor — HENRYHUB.ai",
  description:
    "Real-time natural gas community sentiment analysis from Reddit discussions.",
};

export default function SentimentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col noise-bg">
      <header className="flex items-center gap-4 px-4 py-2 border-b border-terminal-border bg-[#0a0a0a] relative z-10">
        <Link href="/" className="shrink-0">
          <Image
            src="/logo.svg"
            alt="HENRYHUB.ai"
            width={170}
            height={45}
            priority
          />
        </Link>
        <div className="w-px h-6 bg-terminal-border" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white">
          Sentiment Monitor
        </span>
        <div className="ml-auto">
          <Link
            href="/"
            className="text-[9px] text-terminal-muted hover:text-white transition-colors uppercase tracking-wider"
          >
            &larr; Terminal
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">{children}</main>

      <footer className="px-4 py-1 border-t border-terminal-border flex items-center justify-between text-[9px] text-terminal-muted bg-[#0a0a0a] relative z-10">
        <span>&copy; {new Date().getFullYear()} Alconbury Tech Ltd</span>
        <div className="flex items-center gap-3">
          <Link
            href="/privacy"
            className="hover:text-white transition-colors uppercase tracking-wider"
          >
            Privacy
          </Link>
          <div className="w-px h-3 bg-terminal-border" />
          <Link
            href="/terms"
            className="hover:text-white transition-colors uppercase tracking-wider"
          >
            Terms
          </Link>
          <div className="w-px h-3 bg-terminal-border" />
          <Link
            href="/disclaimer"
            className="hover:text-white transition-colors uppercase tracking-wider"
          >
            Disclaimer
          </Link>
        </div>
      </footer>
    </div>
  );
}
