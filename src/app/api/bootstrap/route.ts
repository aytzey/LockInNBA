import { after, NextResponse } from "next/server";
import { getPublicGames, getPublicPredictionPreview, persistGamesSnapshot } from "@/lib/daily-edge";
import { DEFAULT_SOCIAL_PROOF_TEXT, getSiteCopy, getSocialProofBanner } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const date = getEstDateKey();
  const [gamesResult, prediction, socialProofBanner, siteCopy] = await Promise.all([
    getPublicGames(date),
    getPublicPredictionPreview(date),
    getSocialProofBanner(),
    getSiteCopy(),
  ]);
  const cacheSnapshot = gamesResult.cacheSnapshot;

  if (cacheSnapshot) {
    after(async () => {
      try {
        await persistGamesSnapshot(date, cacheSnapshot);
      } catch {
        // Serve the live snapshot even if the cache write falls behind.
      }
    });
  }

  return NextResponse.json(
    {
      date,
      games: gamesResult.games,
      updatedAt: gamesResult.updatedAt,
      refreshed: gamesResult.refreshed,
      source: gamesResult.source,
      prediction: {
        date,
        isNoEdgeDay: prediction.isNoEdgeDay,
        teaserText: prediction.teaserText,
        hasPrediction: Boolean(prediction.markdownContent.trim()),
        isBlurred: true,
      },
      socialProof: {
        text: socialProofBanner?.text || DEFAULT_SOCIAL_PROOF_TEXT,
        isActive: true,
      },
      siteCopy: {
        dailyCtaText: siteCopy.dailyCtaText,
        noEdgeMessage: siteCopy.noEdgeMessage,
        headerRightText: siteCopy.headerRightText,
        footerDisclaimer: siteCopy.footerDisclaimer,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
