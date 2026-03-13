import { NextResponse } from "next/server";
import { getPublicGames, getPublicPredictionPreview } from "@/lib/daily-edge";
import { DEFAULT_SOCIAL_PROOF_MESSAGES, DEFAULT_SOCIAL_PROOF_TEXT, getActivePromoBanner, getSiteCopy, getSocialProofBanner } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const date = getEstDateKey();
  const [gamesResult, prediction, socialProofBanner, siteCopy, promoBanner] = await Promise.all([
    getPublicGames(date),
    getPublicPredictionPreview(date),
    getSocialProofBanner(),
    getSiteCopy(),
    getActivePromoBanner(),
  ]);
  const socialProofMessages = socialProofBanner?.messages?.length
    ? socialProofBanner.messages
    : DEFAULT_SOCIAL_PROOF_MESSAGES;

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
        text: socialProofMessages[0] || DEFAULT_SOCIAL_PROOF_TEXT,
        messages: socialProofMessages,
        isActive: true,
      },
      siteCopy: {
        dailyCtaText: siteCopy.dailyCtaText,
        dailyPriceSubtext: siteCopy.dailyPriceSubtext,
        noEdgeMessage: siteCopy.noEdgeMessage,
        headerRightText: siteCopy.headerRightText,
        metaDescription: siteCopy.metaDescription,
        footerDisclaimer: siteCopy.footerDisclaimer,
      },
      promoBanner: promoBanner
        ? {
            isActive: promoBanner.isActive,
            bannerText: promoBanner.bannerText,
            endDatetime: promoBanner.endDatetime,
          }
        : null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
