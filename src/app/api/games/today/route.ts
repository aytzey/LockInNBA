import { NextResponse } from "next/server";
import { syncTodayGames } from "@/lib/daily-edge";
import { getEstDateKey } from "@/lib/time";

export async function GET() {
  const date = getEstDateKey();
  const games = await syncTodayGames(date);
  return NextResponse.json({
    date,
    games,
  });
}
