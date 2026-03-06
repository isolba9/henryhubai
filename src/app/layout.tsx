import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HENRYHUB.ai — Terminal",
  description:
    "Claude-powered terminal for Henry Hub natural gas data, prices, and analysis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
