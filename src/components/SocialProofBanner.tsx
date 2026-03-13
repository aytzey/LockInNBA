"use client";

interface SocialProofBannerProps {
  messages: string[];
}

export default function SocialProofBanner({ messages }: SocialProofBannerProps) {
  const items = messages.map((message) => message.trim()).filter(Boolean);
  if (items.length === 0) return null;

  const duration = Math.max(34, items.length * 14);

  return (
    <section className="social-banner fade-in" style={{ ["--ticker-duration" as string]: `${duration}s` }}>
      <div className="social-banner__edge social-banner__edge--left" />
      <div className="social-banner__edge social-banner__edge--right" />
      <div className="social-banner__track">
        {[0, 1].map((copy) => (
          <div key={copy} className="social-banner__marquee">
            {items.map((message, index) => (
              <span key={`${copy}-${index}-${message}`} className="social-banner__item">
                <span className="social-banner__dot" />
                <span className="mono">{message}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
