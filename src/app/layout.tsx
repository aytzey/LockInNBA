import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ToasterProvider } from "@/components/ToasterProvider";
import { getSiteCopy } from "@/lib/store";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--font-display",
});

const bodyFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-body",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export async function generateMetadata(): Promise<Metadata> {
  let description = "LOCKIN is a premium AI sports analytics platform delivering nightly NBA moneyline analysis and per-game statistical insights.";

  try {
    description = (await getSiteCopy()).metaDescription || description;
  } catch {
    // Keep a Stripe-safe fallback when DB access is unavailable.
  }

  return {
    title: "LOCKIN | Tonight's Edge",
    description,
    icons: {
      icon: [{ url: "/lockin-mark.svg", type: "image/svg+xml" }],
      shortcut: "/lockin-mark.svg",
      apple: "/lockin-mark.svg",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0A0E1A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} antialiased`}>
        <noscript>
          <div style={{ padding: "12px 16px", background: "#0A0E1A", color: "#F5F5F3", fontFamily: "sans-serif" }}>
            LOCKIN works best with JavaScript enabled. You can still view static site content, but live scores and unlock flows require scripts.
          </div>
        </noscript>
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
