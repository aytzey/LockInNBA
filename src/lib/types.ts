export type MoneylineStatus = "upcoming" | "live" | "final";

export interface DailyPrediction {
  id: string;
  date: string;
  markdownContent: string;
  teaserText: string;
  isNoEdgeDay: boolean;
  source: "auto" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface DailyPick {
  id: string;
  date: string;
  gameId: string;
  pickedSide: "away" | "home";
  analysisMarkdown: string;
  result: "pending" | "win" | "loss";
  profitUnits: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyPickWithGame extends DailyPick {
  game: Game | null;
}

export interface DailyEdgePreview {
  date: string;
  status: "pending" | "ready" | "no_edge";
  hasPrediction: boolean;
  isNoEdgeDay: boolean;
  pickCount: number;
}

export interface DailySlateSummary {
  date: string;
  status: "pending" | "ready" | "no_edge";
  isNoEdgeDay: boolean;
  pickCount: number;
  updatedAt: string;
}

export interface SocialProofBanner {
  id: string;
  messages: string[];
  isActive: boolean;
  updatedAt: string;
}

export interface SiteCopy {
  id: string;
  dailyCtaText: string;
  dailyPriceSubtext: string;
  noEdgeMessage: string;
  headerRightText: string;
  metaDescription: string;
  footerDisclaimer: string;
  trackRecordMarkdown: string;
  updatedAt: string;
}

export interface PromoBanner {
  id: string;
  isActive: boolean;
  bannerText: string;
  endDatetime: string;
  updatedAt: string;
}

export interface SystemPrompt {
  id: string;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

export interface Game {
  id: string;
  date: string;
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
  status: MoneylineStatus;
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
  apiGameId: string;
}

export interface MatchMarkdown {
  id: string;
  gameId: string;
  date: string;
  markdownContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  chatSessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  gameId: string;
  sessionToken: string;
  email: string | null;
  questionLimit: number;
  questionsUsed: number;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  stripePaymentId: string;
  stripeCustomerEmail: string;
  type: "daily_pick" | "match_chat" | "extra_questions";
  amount: number;
  status: "pending" | "paid" | "failed";
  metadata: {
    gameId?: string;
    chatSessionId?: string;
  };
  grantedAt: string;
}

export interface MagicLinkToken {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  isUsed: boolean;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface AccessTokenPayload {
  sub: string;
  type: "daily" | "chat";
  date?: string;
  sessionId?: string;
  gameId?: string;
  exp: number;
  iat: number;
}
