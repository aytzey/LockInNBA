"use client";

interface SocialProofBannerProps {
  text: string;
}

export default function SocialProofBanner({ text }: SocialProofBannerProps) {
  if (!text) return null;

  return (
    <section className="social-banner fade-in">
      <div className="social-banner__edge social-banner__edge--left" />
      <div className="social-banner__edge social-banner__edge--right" />
      <div className="social-banner__track">
        {[0, 1].map((copy) => (
          <div key={copy} className="social-banner__marquee">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={`${copy}-${index}`} className="social-banner__item">
                <span className="social-banner__dot" />
                <span className="mono">{text}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
