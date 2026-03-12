export type Game = {
  id: string;
  awayTeam: string;
  homeTeam: string;
  gameTimeEST: string;
  status: "upcoming" | "live" | "final";
  awayScore: number | null;
  homeScore: number | null;
  awayMoneyline: number;
  homeMoneyline: number;
  oddsSource: "DraftKings" | "FanDuel" | "BetMGM";
};

export type TodayPrediction = {
  date: string;
  isNoEdgeDay: boolean;
  teaserText: string;
  hasPrediction: boolean;
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
