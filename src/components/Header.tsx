"use client";

import Image from "next/image";
import { todayEstLabel } from "./utils";

export default function Header() {
  return (
    <header className="site-header relative overflow-hidden rounded-[1.75rem] px-5 py-4 md:px-6">
      <div className="site-header__mesh" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image
            src="/lockin-logo.svg"
            alt="LOCKIN"
            width={124}
            height={40}
            priority
          />
          <span className="hidden rounded-full border border-[color:var(--accent-line)] bg-[color:var(--accent-soft)] px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-[color:var(--accent-strong)] sm:inline-block">
            LIVE BOARD
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Eastern Time</div>
            <div className="mono text-xs text-[var(--text-soft)]">{todayEstLabel()}</div>
          </div>
          <div className="status-orb hidden sm:block" />
        </div>
      </div>
    </header>
  );
}
