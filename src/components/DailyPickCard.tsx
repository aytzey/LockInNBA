"use client";
/* eslint-disable @next/next/no-img-element */

import MarkdownContent from "./MarkdownContent";
import type { DailyPick } from "./types";
import { formatEstTime, moneyline } from "./utils";

interface DailyPickCardProps {
  pick: DailyPick;
  showResultMeta?: boolean;
}

export default function DailyPickCard({ pick, showResultMeta = false }: DailyPickCardProps) {
  if (!pick.game) {
    return null;
  }

  const { game } = pick;
  const awayPicked = pick.pickedSide === "away";
  const homePicked = pick.pickedSide === "home";
  const resultLabel =
    pick.result === "win"
      ? "WIN"
      : pick.result === "loss"
        ? "LOSS"
        : "PENDING";
  const profitLabel =
    typeof pick.profitUnits === "number" && Number.isFinite(pick.profitUnits)
      ? `${pick.profitUnits > 0 ? "+" : ""}${pick.profitUnits}u`
      : null;

  return (
    <article className="game-card daily-pick-card">
      <div className="flex items-start justify-between gap-3 md:gap-4">
        <div className="min-w-0 flex-1">
          <div className="game-card__identity-row">
            <div className="game-card__identity-team">
              <img src={game.awayLogo} alt={game.awayTeam} className="game-card__logo" loading="lazy" />
              <span className="heading game-card__identity-code">{game.awayTeam}</span>
            </div>
            <span className="game-card__identity-separator">@</span>
            <div className="game-card__identity-team">
              <img src={game.homeLogo} alt={game.homeTeam} className="game-card__logo" loading="lazy" />
              <span className="heading game-card__identity-code">{game.homeTeam}</span>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[color:var(--silver-gray)] md:mt-2 md:gap-3 md:text-[11px]">
            <span>{formatEstTime(game.gameTimeEST)} ET</span>
            <span className="text-[color:var(--line-strong)]">•</span>
            <span>via {game.oddsSource}</span>
          </div>
        </div>

        <span className="daily-pick-card__badge">PICK</span>
      </div>

      <div className="mt-3 md:mt-5">
        <div className="game-card__market-row daily-pick-card__market-row">
          <div className={awayPicked ? "game-card__market-entry daily-pick-card__market-entry daily-pick-card__market-entry--picked" : "game-card__market-entry daily-pick-card__market-entry"}>
            <span className="game-card__market-team">{game.awayTeam}</span>
            <span className="game-card__market-value">{moneyline(game.awayMoneyline)}</span>
            {awayPicked ? <span className="daily-pick-card__pick-tag">OUR PICK</span> : null}
          </div>
          <span className="game-card__market-divider">|</span>
          <div className={homePicked ? "game-card__market-entry game-card__market-entry--right daily-pick-card__market-entry daily-pick-card__market-entry--picked" : "game-card__market-entry game-card__market-entry--right daily-pick-card__market-entry"}>
            <span className="game-card__market-team">{game.homeTeam}</span>
            <span className="game-card__market-value">{moneyline(game.homeMoneyline)}</span>
            {homePicked ? <span className="daily-pick-card__pick-tag">OUR PICK</span> : null}
          </div>
        </div>
      </div>

      {pick.analysisMarkdown.trim() ? (
        <div className="daily-pick-card__analysis">
          <MarkdownContent content={pick.analysisMarkdown} className="text-sm" />
        </div>
      ) : null}

      {showResultMeta ? (
        <div className="daily-pick-card__result-row">
          <span className="daily-pick-card__result-pill">{resultLabel}</span>
          {profitLabel ? <span className="daily-pick-card__result-value">{profitLabel}</span> : null}
        </div>
      ) : null}
    </article>
  );
}
