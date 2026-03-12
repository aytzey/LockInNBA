export type MoneylineStatus = "upcoming" | "live" | "final";

export interface DailyPrediction {
  id: string;
  date: string;
  markdownContent: string;
  teaserText: string;
  isNoEdgeDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SocialProofBanner {
  id: string;
  text: string;
  isActive: boolean;
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
  homeTeam: string;
  gameTimeEST: string;
  status: MoneylineStatus;
  awayScore: number | null;
  homeScore: number | null;
  awayMoneyline: number;
  homeMoneyline: number;
  oddsSource: "DraftKings" | "FanDuel" | "BetMGM";
  apiGameId: string;
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

