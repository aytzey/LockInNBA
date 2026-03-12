"use client";

interface SocialProofBannerProps {
  text: string;
}

export default function SocialProofBanner({ text }: SocialProofBannerProps) {
  if (!text) return null;

  return (
    <section className="rounded-lg border border-[#00c853]/35 bg-[#101a2c] p-3 text-center text-sm text-[#00ff87]">
      <span className="inline-block animate-pulse">{text}</span>
    </section>
  );
}
