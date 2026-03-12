"use client";

import type { Game } from "./types";
import { formatEstTime, moneyline, isPositiveMoneyline } from "./utils";

interface GameCardProps {
  game: Game;
  onOpenChat: (game: Game) => void;
}

function statusBadge(status: Game["status"]): { className: string; label: string } {
  if (status === "live") {
    return {
      className: "bg-[#ff3b3b] text-white",
      label: "LIVE",
    };
  }
  if (status === "final") {
    return {
      className: "bg-[#2a3142] text-[#8b92a5]",
      label: "FINAL",
    };
  }
  return {
    className: "bg-[#1c2233] text-[#8b92a5]",
    label: "UPCOMING",
  };
}

export default function GameCard({ game, onOpenChat }: GameCardProps) {
  const badge = statusBadge(game.status);

  return (
    <button
      type="button"
      onClick={() => onOpenChat(game)}
      className="group w-full rounded-lg border border-[#2a3852] bg-[#101a2c] p-4 text-left transition-all duration-200 hover:border-[#00c853] hover:bg-[#101a2c]/80 focus:outline-none focus:ring-1 focus:ring-[#00c853]/50"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-white">
          <span>{game.awayTeam}</span>
          <span className="mx-1.5 text-[#8b92a5]">@</span>
          <span>{game.homeTeam}</span>
        </div>
        <span className={`mono flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${badge.className}`}>
          {game.status === "live" && <span className="live-dot" />}
          {badge.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8b92a5]">
        <span>{formatEstTime(game.gameTimeEST)} EST</span>
        <span>{game.oddsSource}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className={`mono rounded bg-black/25 p-2 text-center text-sm ${isPositiveMoneyline(game.awayMoneyline) ? "text-[#ff6b35]" : "text-[#00c853]"}`}>
          {game.awayTeam} {moneyline(game.awayMoneyline)}
        </div>
        <div className={`mono rounded bg-black/25 p-2 text-center text-sm ${isPositiveMoneyline(game.homeMoneyline) ? "text-[#ff6b35]" : "text-[#00c853]"}`}>
          {game.homeTeam} {moneyline(game.homeMoneyline)}
        </div>
      </div>

      {game.status === "final" && game.awayScore !== null && game.homeScore !== null && (
        <div className="mt-2 text-center text-xs text-[#8b92a5]">
          Final: {game.awayTeam} {game.awayScore} — {game.homeTeam} {game.homeScore}
        </div>
      )}

      <div className="mt-3 text-center text-xs text-[#8b92a5] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        Click to discuss with AI
      </div>
    </button>
  );
}
