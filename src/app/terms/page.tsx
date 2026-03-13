import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "LOCKIN | Terms",
  description: "Terms for LOCKIN digital access, paid picks, and matchup chat.",
};

const sections = [
  {
    title: "Digital Product",
    body:
      "LOCKIN sells digital access to NBA analysis content, including a daily premium read and paid matchup chat sessions. Access is limited, revocable, and tied to the purchase flow described on the site.",
  },
  {
    title: "No Sportsbook Or Wagering Service",
    body:
      "LOCKIN does not accept wagers, hold player funds, or operate as a sportsbook. Content is provided for informational and entertainment purposes only. Outcomes are never guaranteed.",
  },
  {
    title: "Payments And Access",
    body:
      "Purchases grant access only to the specific digital entitlement purchased. Daily access restores are limited to valid paid access for the current eligible period. Match chat access and extra question packs apply only to the paid session they were purchased for.",
  },
  {
    title: "User Responsibilities",
    body:
      "You are responsible for providing an accurate email address during checkout or restore requests, complying with applicable law in your jurisdiction, and using the product only for lawful personal purposes.",
  },
  {
    title: "Availability",
    body:
      "We may change, suspend, or remove features to maintain reliability, security, or legal compliance. Live scores, lines, and AI outputs may be delayed, incomplete, or unavailable due to provider or network issues.",
  },
  {
    title: "Responsible Gaming",
    body:
      "Do not treat LOCKIN content as financial, legal, or guaranteed betting advice. If you or someone you know has a gambling problem, call 1-800-GAMBLER.",
  },
];

export default function TermsPage() {
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
            <h1 className="font-display text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Terms Of Use</h1>
            <p className="max-w-2xl text-sm leading-7 text-[color:var(--silver-gray)]">
              These terms govern use of LOCKIN and the paid digital access products available on lockinpicks.com.
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
