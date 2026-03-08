import Image from "next/image";
import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col noise-bg">
      {/* Header */}
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
        <Link
          href="/"
          className="text-[9px] text-terminal-muted hover:text-white transition-colors uppercase tracking-wider"
        >
          &larr; Back to Terminal
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 border-t border-terminal-border bg-[#0a0a0a] relative z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-[9px] text-terminal-muted">
          <span>&copy; {new Date().getFullYear()} Alconbury Tech Ltd</span>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-white transition-colors uppercase tracking-wider">
              Privacy
            </Link>
            <div className="w-px h-3 bg-terminal-border" />
            <Link href="/terms" className="hover:text-white transition-colors uppercase tracking-wider">
              Terms
            </Link>
            <div className="w-px h-3 bg-terminal-border" />
            <Link href="/disclaimer" className="hover:text-white transition-colors uppercase tracking-wider">
              Disclaimer
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
