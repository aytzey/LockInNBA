import type { Metadata } from "next";
import "./globals.css";
import { ToasterProvider } from "@/components/ToasterProvider";

export const metadata: Metadata = {
  title: "LOCKIN | AI NBA Picks",
  description: "LOCKIN — Anti-hack filtered NBA Moneyline insights and AI chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
