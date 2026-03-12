import { NextResponse } from "next/server";
import { getFreshGames } from "@/lib/daily-edge";
import { getEstDateKey } from "@/lib/time";

export async function GET() {
  const date = getEstDateKey();
  const result = await getFreshGames(date);
  return NextResponse.json({
    date,
    games: result.games,
    updatedAt: result.updatedAt,
    refreshed: result.refreshed,
  });
}
