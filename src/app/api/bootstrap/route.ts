import { NextResponse } from "next/server";
import { getPublicGames, getPublicPredictionPreview } from "@/lib/daily-edge";
import { DEFAULT_SITE_COPY_CONTENT, DEFAULT_SOCIAL_PROOF_MESSAGES, DEFAULT_SOCIAL_PROOF_TEXT, getActivePromoBanner, getSiteCopy, getSocialProofBanner } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const date = getEstDateKey();
    const results = await Promise.allSettled([
      getPublicGames(date),
      getPublicPredictionPreview(date),
      getSocialProofBanner(),
      getSiteCopy(),
      getActivePromoBanner(),
    ]);

    const gamesResult = results[0].status === "fulfilled"
      ? results[0].value
      : { games: [], updatedAt: new Date().toISOString(), refreshed: false, source: "cache" as const };

    const prediction = results[1].status === "fulfilled"
      ? results[1].value
      : { isNoEdgeDay: false, teaserText: "", markdownContent: "" };

    const socialProofBanner = results[2].status === "fulfilled" ? results[2].value : null;
    const siteCopy = results[3].status === "fulfilled" ? results[3].value : DEFAULT_SITE_COPY_CONTENT;
    const promoBanner = results[4].status === "fulfilled" ? results[4].value : null;

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
              updatedAt: promoBanner.updatedAt,
            }
          : null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (err) {
    console.warn("[LOCKIN] bootstrap route error:", err);
    return NextResponse.json(
      { error: "bootstrap_failed" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
