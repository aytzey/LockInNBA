import { after, NextResponse } from "next/server";
import { getPublicGames, persistGamesSnapshot } from "@/lib/daily-edge";
import { getEstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const date = getEstDateKey();
  const result = await getPublicGames(date);
  const cacheSnapshot = result.cacheSnapshot;
  const cacheControl =
    result.cacheControl === "fixture"
      ? "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
      : "no-store, max-age=0";

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
        "Cache-Control": cacheControl,
      },
    },
  );
}
