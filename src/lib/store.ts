import crypto from "node:crypto";
import {
  ChatMessage,
  ChatSession,
  DailyPrediction,
  Game,
  MagicLinkToken,
  Payment,
  SocialProofBanner,
  SystemPrompt,
} from "./types";
import { getEstDateKey } from "./time";

const NOW = new Date().toISOString();

interface CheckoutSession {
  id: string;
  email: string;
  type: "daily_pick" | "match_chat" | "extra_questions";
  amount: number;
  gameId?: string;
  chatSessionId?: string;
  status: "pending" | "paid";
  createdAt: string;
}

interface AppState {
  predictions: DailyPrediction[];
  socialProofBanner: SocialProofBanner | null;
  systemPrompts: SystemPrompt[];
  games: Game[];
  chatSessions: ChatSession[];
  chatMessages: ChatMessage[];
  payments: Payment[];
  checkoutSessions: CheckoutSession[];
  magicLinks: MagicLinkToken[];
}

const defaultPrompt = {
  id: crypto.randomUUID(),
  content:
    "Sen LOCKIN'ın NBA analiz asistanısın. Veri odaklı ve net konuş. Sadece istatistiksel avantajları göster, kesin sonuç vaadi verme, bahis tavsiyesi olarak yorumlanmaması için dikkatli ol.",
  version: 1,
  isActive: true,
  createdAt: NOW,
};

const defaultPrediction: DailyPrediction = {
  id: crypto.randomUUID(),
  date: getEstDateKey(),
  teaserText:
    "Tonight's top edge: loading dynamic signal from model. The edge engine keeps one lane focused on pace-curve and defensive mismatch spots.",
  markdownContent:
    "# LOCKIN Preview\n\n## Tonight's edge\n\n- Away team has superior transition efficiency on road (6th in pace tempo-adjusted points in last 7).\n- Home team gives up second-chance points above league average.\n- Lean: Away ML for controlled edge only.\n\n## Confidence\nMedium.\n\nUse your bankroll rules, never chase.",
  isNoEdgeDay: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const defaultBanner: SocialProofBanner = {
  id: crypto.randomUUID(),
  text: "Yesterday: 4-1 (+3.5u) | Last 7 Days: 18-9 (67% Win Rate)",
  isActive: true,
  updatedAt: NOW,
};

const teams = [
  "LAL",
  "BOS",
  "DAL",
  "MIA",
  "GSW",
  "HOU",
  "PHI",
];

function makeGames(date: string): Game[] {
  const today = new Date(`${date}T00:00:00-05:00`);
  return teams.slice(0, 4).map((team, index) => {
    const away = teams[(index + 2) % teams.length];
    const status: Game["status"] = index === 0 ? "live" : index === 3 ? "final" : "upcoming";
    const gameTimeEST = new Date(today.getTime() + index * 90 * 60 * 1000).toISOString();
    return {
      id: crypto.randomUUID(),
      date,
      awayTeam: away,
      homeTeam: team,
      gameTimeEST,
      status,
      awayScore: status === "final" ? 104 + index : null,
      homeScore: status === "final" ? 112 + index : null,
      awayMoneyline: index % 2 === 0 ? -105 + index : 120 + index * 2,
      homeMoneyline: index % 2 === 0 ? 140 - index : -128 + index,
      oddsSource: index % 2 === 0 ? "DraftKings" : "FanDuel",
      apiGameId: `nba-${date}-${index + 1}`,
    };
  });
}

const g: AppState = {
  predictions: [defaultPrediction],
  socialProofBanner: defaultBanner,
  systemPrompts: [defaultPrompt],
  games: makeGames(getEstDateKey()),
  chatSessions: [],
  chatMessages: [],
  payments: [],
  checkoutSessions: [],
  magicLinks: [],
};

declare global {
  var __lockinStore: AppState | undefined;
}

const globalState = (globalThis as unknown as { __lockinStore?: AppState }).__lockinStore || g;
if (!(globalThis as { __lockinStore?: AppState }).__lockinStore) {
  (globalThis as { __lockinStore?: AppState }).__lockinStore = globalState;
}

function amountForPayment(type: "daily_pick" | "match_chat" | "extra_questions"): number {
  if (type === "daily_pick") return 5;
  if (type === "match_chat") return 2;
  return 1;
}

export function ensureDateData(date = getEstDateKey()): void {
  const existing = globalState.predictions.find((item) => item.date === date);
  if (!existing) {
    const pred = {
      ...defaultPrediction,
      id: crypto.randomUUID(),
      date,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    globalState.predictions.push(pred);
  }

  const hasGames = globalState.games.some((game) => game.date === date);
  if (!hasGames) {
    globalState.games.push(...makeGames(date));
  }
}

export function getTodayPrediction(date = getEstDateKey()): DailyPrediction {
  ensureDateData(date);
  return globalState.predictions.find((item) => item.date === date)!;
}

export function listPredictions(): DailyPrediction[] {
  return [...globalState.predictions].sort((a, b) => b.date.localeCompare(a.date));
}

export function savePrediction(input: {
  id?: string;
  date: string;
  teaserText: string;
  markdownContent: string;
  isNoEdgeDay: boolean;
}): DailyPrediction {
  const now = new Date().toISOString();
  ensureDateData(input.date);
  const existing = globalState.predictions.find((item) => item.id === input.id || item.date === input.date);
  if (existing) {
    existing.date = input.date;
    existing.teaserText = input.teaserText;
    existing.markdownContent = input.markdownContent;
    existing.isNoEdgeDay = input.isNoEdgeDay;
    existing.updatedAt = now;
    return existing;
  }

  const created: DailyPrediction = {
    id: crypto.randomUUID(),
    date: input.date,
    teaserText: input.teaserText,
    markdownContent: input.markdownContent,
    isNoEdgeDay: input.isNoEdgeDay,
    createdAt: now,
    updatedAt: now,
  };

  globalState.predictions.push(created);
  return created;
}

export function deletePrediction(id: string): void {
  globalState.predictions = globalState.predictions.filter((item) => item.id !== id);
}

export function getSocialProofBanner(): SocialProofBanner | null {
  if (!globalState.socialProofBanner?.isActive || !globalState.socialProofBanner.text.trim()) {
    return null;
  }
  return globalState.socialProofBanner;
}

export function setSocialProofBanner(text: string): SocialProofBanner {
  globalState.socialProofBanner = {
    id: globalState.socialProofBanner?.id || crypto.randomUUID(),
    text,
    isActive: text.trim().length > 0,
    updatedAt: new Date().toISOString(),
  };
  return globalState.socialProofBanner;
}

export function getActiveSystemPrompt(): SystemPrompt {
  return globalState.systemPrompts.find((item) => item.isActive) || defaultPrompt;
}

export function listSystemPrompts(limit = 5): SystemPrompt[] {
  return [...globalState.systemPrompts].sort((a, b) => b.version - a.version).slice(0, limit);
}

export function saveSystemPrompt(content: string): SystemPrompt {
  const nextVersion = (globalState.systemPrompts.at(-1)?.version || 0) + 1;
  globalState.systemPrompts = globalState.systemPrompts.map((item) => ({
    ...item,
    isActive: false,
  }));

  const created: SystemPrompt = {
    id: crypto.randomUUID(),
    content,
    version: nextVersion,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  globalState.systemPrompts.push(created);
  globalState.systemPrompts.sort((a, b) => a.version - b.version);
  if (globalState.systemPrompts.length > 10) {
    globalState.systemPrompts = globalState.systemPrompts.slice(-10);
  }
  return created;
}

export function getGames(date = getEstDateKey()): Game[] {
  ensureDateData(date);
  return globalState.games
    .filter((item) => item.date === date)
    .sort((a, b) => {
      if (a.status === "final" && b.status !== "final") return 1;
      if (a.status !== "final" && b.status === "final") return -1;
      return new Date(a.gameTimeEST).getTime() - new Date(b.gameTimeEST).getTime();
    });
}

export function setGames(date: string, games: Omit<Game, "id" | "date">[]): void {
  globalState.games = globalState.games.filter((item) => item.date !== date);
  globalState.games.push(
    ...games.map((game) => ({
      ...game,
      id: crypto.randomUUID(),
      date,
    })),
  );
}

export function createChatSession(gameId: string): ChatSession {
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: crypto.randomUUID(),
    gameId,
    sessionToken: crypto.randomUUID(),
    email: null,
    questionLimit: 0,
    questionsUsed: 0,
    isPaid: false,
    createdAt: now,
    updatedAt: now,
  };
  globalState.chatSessions.push(session);
  return session;
}

export function getChatSession(sessionId: string): ChatSession | null {
  return globalState.chatSessions.find((session) => session.id === sessionId) || null;
}

export function getChatMessages(sessionId: string): ChatMessage[] {
  return globalState.chatMessages.filter((msg) => msg.chatSessionId === sessionId);
}

export function addChatMessage(sessionId: string, role: "user" | "assistant", content: string): ChatMessage {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    chatSessionId: sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  globalState.chatMessages.push(message);
  return message;
}

export function touchSession(sessionId: string, data: Partial<Pick<ChatSession, "questionLimit" | "questionsUsed" | "isPaid" | "email">>): void {
  const session = getChatSession(sessionId);
  if (!session) return;

  session.updatedAt = new Date().toISOString();
  if (data.questionLimit !== undefined) session.questionLimit = data.questionLimit;
  if (data.questionsUsed !== undefined) session.questionsUsed = data.questionsUsed;
  if (data.isPaid !== undefined) session.isPaid = data.isPaid;
  if (data.email !== undefined) session.email = data.email;
}

export function hasChatCapacity(sessionId: string): boolean {
  const session = getChatSession(sessionId);
  if (!session) return false;
  return session.questionsUsed < session.questionLimit;
}

export function remainingQuestions(sessionId: string): number {
  const session = getChatSession(sessionId);
  if (!session) return 0;
  return Math.max(0, session.questionLimit - session.questionsUsed);
}

export function createCheckoutSession(input: {
  email: string;
  type: "daily_pick" | "match_chat" | "extra_questions";
  gameId?: string;
  chatSessionId?: string;
}): { id: string; amount: number } {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const amount = amountForPayment(input.type);
  const session: CheckoutSession = {
    id,
    email: input.email,
    type: input.type,
    amount,
    gameId: input.gameId,
    chatSessionId: input.chatSessionId,
    status: "pending",
    createdAt: now,
  };
  globalState.checkoutSessions = globalState.checkoutSessions.filter((item) => item.id !== id);
  globalState.checkoutSessions.push(session);
  return { id, amount };
}

export function getCheckoutSession(id: string): {
  id: string;
  email: string;
  type: "daily_pick" | "match_chat" | "extra_questions";
  amount: number;
  gameId?: string;
  chatSessionId?: string;
  status: "pending" | "paid";
  createdAt: string;
} | null {
  const session = globalState.checkoutSessions.find((item) => item.id === id);
  return session || null;
}

export function completeCheckout(sessionId: string, paymentId: string): Payment | null {
  const session = globalState.checkoutSessions.find((item) => item.id === sessionId);
  if (!session || session.status === "paid") return null;

  const now = new Date().toISOString();
  session.status = "paid";

  const payment: Payment = {
    id: crypto.randomUUID(),
    stripePaymentId: paymentId,
    stripeCustomerEmail: session.email,
    type: session.type,
    amount: session.amount,
    status: "paid",
    metadata: {
      gameId: session.gameId,
      chatSessionId: session.chatSessionId,
    },
    grantedAt: now,
  };

  globalState.payments.push(payment);
  if (session.type === "match_chat") {
    const chatSession = getChatSession(session.chatSessionId ?? "");
    touchSession(session.chatSessionId ?? "", {
      isPaid: true,
      questionLimit: Math.max(3, chatSession?.questionLimit || 0),
      questionsUsed: 0,
      email: session.email,
    });
  }

  if (session.type === "extra_questions") {
    touchSession(session.chatSessionId ?? "", {
      questionLimit: (getChatSession(session.chatSessionId ?? "")?.questionLimit || 0) + 3,
      email: session.email,
    });
  }

  return payment;
}

function hasActiveDailyPayment(email: string, date: string): boolean {
  return globalState.payments.some(
    (payment) =>
      payment.stripeCustomerEmail.toLowerCase() === email.toLowerCase() &&
      payment.type === "daily_pick" &&
      getDate(payment.grantedAt) === date,
  );
}

function hasActiveChatPayment(email: string, sessionId: string): boolean {
  return globalState.payments.some(
    (payment) =>
      payment.stripeCustomerEmail.toLowerCase() === email.toLowerCase() &&
      payment.type !== "daily_pick" &&
      payment.metadata.chatSessionId === sessionId,
  );
}

function getDate(dateTime: string): string {
  return getEstDateKey(new Date(dateTime));
}

export function validateDailyToken(email: string): boolean {
  return hasActiveDailyPayment(email, getEstDateKey());
}

export function createMagicLink(email: string): string | null {
  const today = getEstDateKey();
  if (!hasActiveDailyPayment(email, today)) return null;

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const magic: MagicLinkToken = {
    id: crypto.randomUUID(),
    email,
    token,
    expiresAt,
    isUsed: false,
    createdAt: new Date().toISOString(),
  };
  globalState.magicLinks = globalState.magicLinks.filter((item) => item.token !== token);
  globalState.magicLinks.push(magic);
  return token;
}

export function consumeMagicLink(token: string): { email: string } | null {
  const item = globalState.magicLinks.find((entry) => entry.token === token);
  if (!item || item.isUsed) return null;
  if (new Date(item.expiresAt).getTime() < Date.now()) return null;
  item.isUsed = true;
  return { email: item.email };
}

export function getPaymentForEmail(email: string): Payment[] {
  return globalState.payments.filter((item) => item.stripeCustomerEmail.toLowerCase() === email.toLowerCase());
}

export function getAccessState(email: string, sessionId?: string): {
  daily: boolean;
  chat: boolean;
} {
  return {
    daily: validateDailyToken(email),
    chat: !!sessionId ? hasActiveChatPayment(email, sessionId) : false,
  };
}
