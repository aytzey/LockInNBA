"use client";

import Image from "next/image";
import { todayEstLabel } from "./utils";

export default function Header() {
  return (
    <header className="flex items-center justify-between border border-white/10 bg-[#0f1524] px-3 py-3 md:px-5">
      <div className="flex items-center gap-2">
        <Image
          src="/lockin-logo.svg"
          alt="LOCKIN"
          width={124}
          height={40}
          priority
        />
      </div>
      <div className="mono text-xs text-[#8b92a5]">{todayEstLabel()}</div>
    </header>
  );
}
