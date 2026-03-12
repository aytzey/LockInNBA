"use client";

import Image from "next/image";
import { todayEstLabel } from "./utils";

export default function Header() {
  return (
    <header className="glass relative overflow-hidden rounded-2xl px-5 py-4 md:px-6">
      {/* Top accent line */}
      <div className="absolute left-[20%] right-[20%] top-0 h-px bg-gradient-to-r from-transparent via-[#00c853]/40 to-transparent" />
      {/* Subtle corner glow */}
      <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-[#00c853]/[0.06] blur-[40px]" />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/lockin-logo.svg"
            alt="LOCKIN"
            width={124}
            height={40}
            priority
          />
          <span className="hidden rounded-full border border-[#00c853]/20 bg-[#00c853]/[0.08] px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#00c853] sm:inline-block">
            NBA
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="glow-dot hidden sm:block" />
          <div className="mono text-xs text-[#8b92a5]">{todayEstLabel()}</div>
        </div>
      </div>
    </header>
  );
}
