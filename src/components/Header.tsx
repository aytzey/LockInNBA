"use client";

import Image from "next/image";
import { todayEstLabel } from "./utils";

interface HeaderProps {
  note?: string;
}

export default function Header({ note = "" }: HeaderProps) {
  return (
    <header className="site-header rounded-[1.5rem] px-5 py-4 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/lockin-logo.svg"
            alt="LOCKIN"
            width={124}
            height={40}
            priority
          />
        </div>

        <div className="text-right">
          <div className="mono text-[11px] text-[color:var(--silver-gray)]">
            {todayEstLabel()} EST
          </div>
          {note ? (
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--money-green)]">
              {note}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
