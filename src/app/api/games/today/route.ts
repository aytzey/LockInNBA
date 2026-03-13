import { NextResponse } from "next/server";
import { getPublicGames } from "@/lib/daily-edge";
import { getEstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const date = getEstDateKey();
  const result = await getPublicGames(date);
  return NextResponse.json(
    {
      date,
      games: result.games,
      updatedAt: result.updatedAt,
      refreshed: result.refreshed,
      source: result.source,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
