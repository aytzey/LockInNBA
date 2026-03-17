"use client";

import { LockinBrand } from "./LockinBrand";
import { todayEstLabel } from "./utils";

interface HeaderProps {
  note?: string;
}

export default function Header({ note = "" }: HeaderProps) {
  return (
    <header className="site-header rounded-[1.5rem] px-5 py-4 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <LockinBrand />

        <div className="site-header__meta text-right">
          <div className="site-header__date mono">
            {todayEstLabel()}
          </div>
          {note ? (
            <div className="site-header__note">
              {note}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
