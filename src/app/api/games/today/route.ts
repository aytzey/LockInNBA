import { after, NextResponse } from "next/server";
import { getPublicGames, persistGamesSnapshot } from "@/lib/daily-edge";
import { getEstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const date = getEstDateKey();
  const result = await getPublicGames(date);
  const cacheSnapshot = result.cacheSnapshot;

  if (cacheSnapshot) {
    after(async () => {
      try {
        await persistGamesSnapshot(date, cacheSnapshot);
      } catch {
        // Keep live reads fast even if the cache write fails.
      }
    });
  }

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
