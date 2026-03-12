import { NextResponse } from "next/server";
import { getGames } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

export async function GET() {
  const date = getEstDateKey();
  const games = getGames(date);
  return NextResponse.json({
    date,
    games,
  });
}

