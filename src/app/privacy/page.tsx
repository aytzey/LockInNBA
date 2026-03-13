import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "LOCKIN | Privacy Policy",
  description: "Privacy policy for LOCKIN transactional access, payment, and matchup chat flows.",
};

const sections = [
  {
    title: "What We Collect",
    body:
      "LOCKIN collects the minimum information needed to deliver paid NBA analysis. This can include your email address, checkout and payment metadata, restore-access requests, matchup chat messages, and basic technical logs tied to fraud prevention and product reliability.",
  },
  {
    title: "How We Use It",
    body:
      "We use this information to process purchases, restore paid access, deliver transactional messages, operate matchup chat, maintain security, investigate abuse, and improve product reliability. We do not run a newsletter or sell your data to data brokers.",
  },
  {
    title: "Transactional Email Only",
    body:
      "If email delivery is enabled, LOCKIN uses email only for transactional events such as purchase-related access and restore links requested by the user. We do not send promotional campaigns, cold outreach, or third-party list mail.",
  },
  {
    title: "Payments",
    body:
      "LOCKIN does not process wagers. Payment providers may collect and process billing details required to complete digital purchases. We store only the local records needed to grant access and verify paid entitlements.",
  },
  {
    title: "Retention",
    body:
      "We retain operational records only as long as reasonably necessary for access restoration, fraud review, support, accounting, and legal compliance. Records may be removed or anonymized when no longer needed.",
  },
  {
    title: "Your Choices",
    body:
      "If you do not want to receive transactional messages, do not submit checkout or restore-access requests. If you believe an address was used incorrectly, contact us through the official LOCKIN site channel used for your purchase or access request.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[color:var(--court-black)] px-6 py-10 text-[color:var(--pure-white)] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl space-y-10">
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex text-[11px] uppercase tracking-[0.24em] text-[color:var(--silver-gray)] transition hover:text-[color:var(--pure-white)]"
          >
            Back to LOCKIN
          </Link>
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.26em] text-[color:var(--gold)]">Effective March 13, 2026</p>
            <h1 className="font-display text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Privacy Policy</h1>
            <p className="max-w-2xl text-sm leading-7 text-[color:var(--silver-gray)]">
              LOCKIN is a paid NBA analysis product. This policy explains what information we collect, how we use it,
              and how transactional access restoration works.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--panel)] px-5 py-5 sm:px-6"
            >
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-[color:var(--pure-white)]">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[color:var(--silver-gray)]">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
