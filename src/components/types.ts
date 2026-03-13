export type Game = {
  id: string;
  awayTeam: string;
  awayDisplayName: string;
  awayRecord: string;
  awayLeader: string;
  awayLogo: string;
  homeTeam: string;
  homeDisplayName: string;
  homeRecord: string;
  homeLeader: string;
  homeLogo: string;
  gameTimeEST: string;
  status: "upcoming" | "live" | "final";
  statusDetail: string;
  awayScore: number | null;
  homeScore: number | null;
  awayMoneyline: number;
  homeMoneyline: number;
  oddsSource: "DraftKings" | "FanDuel" | "BetMGM";
  spread: string;
  total: string;
  broadcast: string;
  venue: string;
  gameUrl: string;
};

export type TodayPrediction = {
  date: string;
  isNoEdgeDay: boolean;
  teaserText: string;
  hasPrediction: boolean;
};

export type SiteCopy = {
  dailyCtaText: string;
  dailyPriceSubtext: string;
  noEdgeMessage: string;
  headerRightText: string;
  metaDescription: string;
  footerDisclaimer: string;
};

export type PromoBanner = {
  isActive: boolean;
  bannerText: string;
  endDatetime: string;
};

export type ChatMessage = {
  id: string;
  chatSessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ChatSessionState = {
  id: string;
  gameId: string;
  sessionToken: string;
  email: string | null;
  questionLimit: number;
  questionsUsed: number;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CheckoutType = "daily_pick" | "match_chat" | "extra_questions";
