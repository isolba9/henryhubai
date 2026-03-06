import type { Metadata } from "next";
import "./globals.css";

const title = "HENRYHUB.ai";
const description =
  "AI dedicated to Natural Gas — AI analysis, historical data and live price";
const url = "https://henryhub.ai";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(url),
  keywords: [
    "Henry Hub",
    "natural gas",
    "natural gas price",
    "Henry Hub price",
    "energy AI",
    "gas storage",
    "EIA data",
    "commodity prices",
    "energy analysis",
  ],
  authors: [{ name: "HENRYHUB.ai" }],
  creator: "HENRYHUB.ai",
  openGraph: {
    type: "website",
    url,
    title,
    description,
    siteName: "HENRYHUB.ai",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "HENRYHUB.ai — AI dedicated to Natural Gas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  robots: { index: true, follow: true },
  other: {
    "theme-color": "#0a0a0a",
  },
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
