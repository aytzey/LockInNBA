"use client";

import { forwardRef } from "react";
import type { Game, ChatMessage, DailyPick } from "./types";
import { moneyline } from "./utils";
import { LockinBrand, LockinMark } from "./LockinBrand";
import MarkdownContent from "./MarkdownContent";

interface ShareCardProps {
  mode: "daily" | "chat";
  headline: string;
  dailyMarkdown: string;
  dailyPicks: DailyPick[];
  selectedGame: Game | null;
  chatMessages: ChatMessage[];
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { mode, headline, dailyMarkdown, dailyPicks, selectedGame, chatMessages },
  ref,
) {
  return (
    <div
      id="share-card-surface"
      aria-hidden="true"
      ref={ref}
      className="fixed left-[-9999px] top-0 z-0 w-[760px] bg-[#0a0e1a] p-0 text-sm"
    >
      <div className="h-1 bg-gradient-to-r from-[#0a0e1a] via-[#00c853] to-[#0a0e1a]" />

      <div className="relative overflow-hidden p-8">
        <div className="pointer-events-none absolute right-8 top-20 opacity-[0.08]">
          <LockinMark className="h-28 w-28" />
        </div>
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <LockinBrand compact />
          <div className="mono text-xs text-[#8b92a5]">lockinpicks.com</div>
        </div>

        {mode === "daily" ? (
          <div className="relative mt-6">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#00c853]">Tonight&apos;s Edge</div>
            <div className="heading mb-3 text-2xl font-bold text-[#f5f5f3]">LOCKIN Daily Edge</div>
            <div className="mb-4 text-sm text-[#8b92a5]">{headline}</div>

            {dailyPicks.length > 0 ? (
              <div className="space-y-3">
                {dailyPicks.map((pick) => {
                  if (!pick.game) return null;
                  const awayPicked = pick.pickedSide === "away";
                  const homePicked = pick.pickedSide === "home";
                  return (
                    <div key={pick.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-base font-semibold text-[#f5f5f3]">
                          <span>{pick.game.awayTeam}</span>
                          <span className="text-xs text-[#8b92a5]">@</span>
                          <span>{pick.game.homeTeam}</span>
                        </div>
                        <span className="rounded-full border border-[#00c853]/20 bg-[#00c853]/[0.08] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#00c853]">
                          pick
                        </span>
                      </div>
                      <div className="mb-3 flex gap-2">
                        <span className={`mono rounded-lg border px-3 py-1.5 text-sm ${awayPicked ? "border-[#00c853]/30 bg-[#00c853]/[0.08] text-[#00c853]" : "border-white/10 bg-white/[0.04] text-[#f5f5f3]"}`}>
                          {pick.game.awayTeam} {moneyline(pick.game.awayMoneyline)}
                          {awayPicked ? " ←" : ""}
                        </span>
                        <span className={`mono rounded-lg border px-3 py-1.5 text-sm ${homePicked ? "border-[#00c853]/30 bg-[#00c853]/[0.08] text-[#00c853]" : "border-white/10 bg-white/[0.04] text-[#f5f5f3]"}`}>
                          {pick.game.homeTeam} {moneyline(pick.game.homeMoneyline)}
                          {homePicked ? " ←" : ""}
                        </span>
                      </div>
                      {pick.analysisMarkdown.trim() ? (
                        <MarkdownContent content={pick.analysisMarkdown} className="text-sm" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : dailyMarkdown.trim() ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <MarkdownContent content={dailyMarkdown} className="text-sm" />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="relative mt-6">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-[#00c853]">Match Insight</div>
            <div className="heading mb-3 text-2xl font-bold text-[#f5f5f3]">
              {selectedGame
                ? `${selectedGame.awayTeam} @ ${selectedGame.homeTeam}`
                : "LOCKIN Match Insight"}
            </div>
            {selectedGame && (
              <div className="mb-4 flex gap-3">
                <span className="mono rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-[#f5f5f3]">
                  {selectedGame.awayTeam} ML {moneyline(selectedGame.awayMoneyline)}
                </span>
                <span className="mono rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-[#f5f5f3]">
                  {selectedGame.homeTeam} ML {moneyline(selectedGame.homeMoneyline)}
                </span>
              </div>
            )}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <MarkdownContent
                content={
                  chatMessages
                    .filter((item) => item.role === "assistant")
                    .slice(-1)
                    .map((msg) => msg.content)
                    .join("\n") || "No assistant response is available for export yet."
                }
                className="text-sm"
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-xs text-[#8b92a5]">Generated by LOCKIN · NBA moneyline analysis</span>
          <span className="rounded-full border border-[#00c853]/20 bg-[#00c853]/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-[#00c853]">
            lockin
          </span>
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
