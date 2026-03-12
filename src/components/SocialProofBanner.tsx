"use client";

interface SocialProofBannerProps {
  text: string;
}

export default function SocialProofBanner({ text }: SocialProofBannerProps) {
  if (!text) return null;

  return (
    <section className="fade-in social-banner relative overflow-hidden rounded-[1.25rem] p-3.5 text-center">
      <div className="social-banner__glow" />
      <div className="relative flex items-center justify-center gap-2.5">
        <span className="status-orb status-orb--small" />
        <span className="mono text-sm tracking-wide text-[color:var(--accent-strong)]">{text}</span>
      </div>
    </section>
  );
}
