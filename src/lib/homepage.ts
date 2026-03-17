import { getPublicGames } from "./daily-edge";
import {
  DEFAULT_SITE_COPY_CONTENT,
  DEFAULT_SOCIAL_PROOF_MESSAGES,
  DEFAULT_SOCIAL_PROOF_TEXT,
  getActivePromoBanner,
  getPublicDailyEdgePreview,
  getPublicSocialProofMessages,
  getResolvedTrackRecordMarkdown,
  getSiteCopy,
} from "./store";
import { getEstDateKey } from "./time";

export interface HomepageBootstrap {
  date: string;
  games: Awaited<ReturnType<typeof getPublicGames>>["games"];
  updatedAt: string;
  refreshed: boolean;
  source: "cache" | "live";
  prediction: Awaited<ReturnType<typeof getPublicDailyEdgePreview>>;
  socialProof: {
    text: string;
    messages: string[];
    isActive: boolean;
  };
  siteCopy: {
    dailyCtaText: string;
    dailyPriceSubtext: string;
    noEdgeMessage: string;
    headerRightText: string;
    metaDescription: string;
    footerDisclaimer: string;
    trackRecordMarkdown: string;
  };
  promoBanner: {
    isActive: boolean;
    bannerText: string;
    endDatetime: string;
    updatedAt: string;
  } | null;
}

export async function getHomepageBootstrap(date = getEstDateKey()): Promise<HomepageBootstrap> {
  const results = await Promise.allSettled([
    getPublicGames(date),
    getPublicDailyEdgePreview(date),
    getPublicSocialProofMessages(),
    getSiteCopy(),
    getActivePromoBanner(),
    getResolvedTrackRecordMarkdown(),
  ]);

  const gamesResult = results[0].status === "fulfilled"
    ? results[0].value
    : { games: [], updatedAt: new Date().toISOString(), refreshed: false, source: "cache" as const };
  const prediction = results[1].status === "fulfilled"
    ? results[1].value
    : { date, status: "pending" as const, hasPrediction: false, isNoEdgeDay: false, pickCount: 0 };
  const socialProofMessagesResult = results[2].status === "fulfilled" ? results[2].value : [];
  const siteCopyResult = results[3].status === "fulfilled" ? results[3].value : null;
  const promoBanner = results[4].status === "fulfilled" ? results[4].value : null;
  const resolvedTrackRecordMarkdown = results[5].status === "fulfilled" ? results[5].value : "";

  const socialProofMessages = socialProofMessagesResult.length > 0
    ? socialProofMessagesResult
    : DEFAULT_SOCIAL_PROOF_MESSAGES;
  const siteCopy = siteCopyResult || {
    id: "default",
    ...DEFAULT_SITE_COPY_CONTENT,
    updatedAt: new Date().toISOString(),
  };

  return {
    date,
    games: gamesResult.games,
    updatedAt: gamesResult.updatedAt ?? new Date().toISOString(),
    refreshed: gamesResult.refreshed,
    source: gamesResult.source,
    prediction,
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
      trackRecordMarkdown: resolvedTrackRecordMarkdown || siteCopy.trackRecordMarkdown,
    },
    promoBanner: promoBanner
      ? {
          isActive: promoBanner.isActive,
          bannerText: promoBanner.bannerText,
          endDatetime: promoBanner.endDatetime,
          updatedAt: promoBanner.updatedAt,
        }
      : null,
  };
}
