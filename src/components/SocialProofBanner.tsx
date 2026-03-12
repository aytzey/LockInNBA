"use client";

interface SocialProofBannerProps {
  text: string;
}

export default function SocialProofBanner({ text }: SocialProofBannerProps) {
  if (!text) return null;

  return (
    <section className="fade-in glass relative overflow-hidden rounded-xl border-[#00c853]/20 p-3.5 text-center">
      {/* Side accent bars */}
      <div className="absolute left-0 top-0 h-full w-0.5 bg-gradient-to-b from-[#00c853] via-[#00c853]/50 to-transparent" />
      <div className="absolute right-0 top-0 h-full w-0.5 bg-gradient-to-b from-[#00c853] via-[#00c853]/50 to-transparent" />
      {/* Top accent line */}
      <div className="absolute left-[10%] right-[10%] top-0 h-px bg-gradient-to-r from-transparent via-[#00c853]/30 to-transparent" />
      <div className="flex items-center justify-center gap-2.5">
        <span className="glow-dot" />
        <span className="mono text-sm tracking-wide text-[#00ff87]">{text}</span>
      </div>
    </section>
  );
}
