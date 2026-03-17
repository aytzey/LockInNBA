import crypto from "node:crypto";
import { query, withTransaction } from "./db";
import {
  ChatMessage,
  ChatSession,
  DailyEdgePreview,
  DailyPick,
  DailyPickWithGame,
  DailyPrediction,
  DailySlateSummary,
  Game,
  MatchMarkdown,
  Payment,
  PromoBanner,
  SiteCopy,
  SocialProofBanner,
  SystemPrompt,
} from "./types";
import { fetchTodayGames, mergeLatestGames } from "./nba";
import { getEstDateKey } from "./time";
import { extractTrackRecordSummary, parseTrackRecordMarkdown } from "./track-record";

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

interface DataRefreshState {
  key: string;
  updatedAt: string;
}

interface TrackRecordResolvedEntry {
  line: string;
  result: "win" | "loss";
  profitUnits: number | null;
}

export const DEFAULT_SOCIAL_PROOF_TEXT = "This Week: 5-0 (100%) | +19.3u ROI";
export const DEFAULT_SOCIAL_PROOF_MESSAGES = [
  "This Week: 5-0 (100%)",
  "+19.3u ROI",
  "We passed on 90% of this week's board",
];
export const DEFAULT_NO_EDGE_BANNER_PREFIX = "Today: No Edge — Protecting Your Bankroll";

export const DEFAULT_SITE_COPY_CONTENT = {
  dailyCtaText: "Unlock Tonight's Edge",
  dailyPriceSubtext: "$5 one-time pass",
  noEdgeMessage: "We passed on 90% of this week's games. We only bet when the math screams.",
  headerRightText: "",
  metaDescription: "LOCKIN is a premium AI sports analytics platform delivering nightly NBA moneyline analysis and per-game statistical insights.",
  footerDisclaimer:
    "For entertainment purposes only. LOCKIN does not accept wagers or guarantee outcomes. If you or someone you know has a gambling problem, call 1-800-GAMBLER.",
  trackRecordMarkdown: "",
};

const DEFAULT_PROMO_BANNER: PromoBanner = {
  id: "default",
  isActive: false,
  bannerText: "LAUNCH WEEK: 100% FREE ACCESS — Unlock every pick & AI chat free for 7 days.",
  endDatetime: "",
  updatedAt: new Date().toISOString(),
};

function getDefaultPromoEndDatetime(): string {
  return new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString();
}

type RowValue = string | number | boolean | Date | null | undefined;

function toIsoString(value: RowValue): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  return new Date().toISOString();
}

function toNumber(value: RowValue): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function toNullableNumber(value: RowValue): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "number" ? value : Number(value);
}

function normalizeMessages(value: RowValue): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item ?? "").trim())
          .filter(Boolean);
      }
    } catch {
      // fall through to line-based parsing
    }

    return trimmed
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function mapPrediction(row: Record<string, RowValue>): DailyPrediction {
  return {
    id: String(row.id),
    date: String(row.date),
    teaserText: String(row.teaser_text ?? ""),
    markdownContent: String(row.markdown_content ?? ""),
    isNoEdgeDay: Boolean(row.is_no_edge_day),
    source: row.source === "admin" ? "admin" : "auto",
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapSocialProofBanner(row: Record<string, RowValue>): SocialProofBanner {
  const messages = normalizeMessages(row.messages_json).length > 0
    ? normalizeMessages(row.messages_json)
    : normalizeMessages(row.text).length > 0
      ? normalizeMessages(row.text)
      : [...DEFAULT_SOCIAL_PROOF_MESSAGES];

  return {
    id: String(row.id),
    messages,
    isActive: Boolean(row.is_active),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapSystemPrompt(row: Record<string, RowValue>): SystemPrompt {
  return {
    id: String(row.id),
    content: String(row.content ?? ""),
    version: toNumber(row.version),
    isActive: Boolean(row.is_active),
    createdAt: toIsoString(row.created_at),
  };
}

function mapSiteCopy(row: Record<string, RowValue>): SiteCopy {
  return {
    id: String(row.id),
    dailyCtaText: String(row.daily_cta_text ?? DEFAULT_SITE_COPY_CONTENT.dailyCtaText),
    dailyPriceSubtext: String(row.daily_price_subtext ?? DEFAULT_SITE_COPY_CONTENT.dailyPriceSubtext),
    noEdgeMessage: String(row.no_edge_message ?? DEFAULT_SITE_COPY_CONTENT.noEdgeMessage),
    headerRightText: String(row.header_right_text ?? DEFAULT_SITE_COPY_CONTENT.headerRightText),
    metaDescription: String(row.meta_description ?? DEFAULT_SITE_COPY_CONTENT.metaDescription),
    footerDisclaimer: String(row.footer_disclaimer ?? DEFAULT_SITE_COPY_CONTENT.footerDisclaimer),
    trackRecordMarkdown: String(row.track_record_markdown ?? DEFAULT_SITE_COPY_CONTENT.trackRecordMarkdown),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapPromoBanner(row: Record<string, RowValue>): PromoBanner {
  return {
    id: String(row.id),
    isActive: Boolean(row.is_active),
    bannerText: String(row.banner_text ?? DEFAULT_PROMO_BANNER.bannerText),
    endDatetime: row.end_datetime ? toIsoString(row.end_datetime) : "",
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapMatchMarkdown(row: Record<string, RowValue>): MatchMarkdown {
  return {
    id: String(row.id),
    gameId: String(row.game_id),
    date: String(row.date),
    markdownContent: String(row.markdown_content ?? ""),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapGame(row: Record<string, RowValue>): Game {
  return {
    id: String(row.id),
    date: String(row.date),
    awayTeam: String(row.away_team),
    awayDisplayName: String(row.away_display_name),
    awayRecord: String(row.away_record ?? ""),
    awayLeader: String(row.away_leader ?? ""),
    awayLogo: String(row.away_logo ?? ""),
    homeTeam: String(row.home_team),
    homeDisplayName: String(row.home_display_name),
    homeRecord: String(row.home_record ?? ""),
    homeLeader: String(row.home_leader ?? ""),
    homeLogo: String(row.home_logo ?? ""),
    gameTimeEST: String(row.game_time_est),
    status: row.status === "live" || row.status === "final" ? row.status : "upcoming",
    statusDetail: String(row.status_detail ?? ""),
    awayScore: toNullableNumber(row.away_score),
    homeScore: toNullableNumber(row.home_score),
    awayMoneyline: toNumber(row.away_moneyline),
    homeMoneyline: toNumber(row.home_moneyline),
    oddsSource:
      row.odds_source === "FanDuel" || row.odds_source === "BetMGM" ? row.odds_source : "DraftKings",
    spread: String(row.spread ?? ""),
    total: String(row.total ?? ""),
    broadcast: String(row.broadcast ?? ""),
    venue: String(row.venue ?? ""),
    gameUrl: String(row.game_url ?? ""),
    apiGameId: String(row.api_game_id ?? ""),
  };
}

function mapDailyPick(row: Record<string, RowValue>): DailyPick {
  return {
    id: String(row.id),
    date: String(row.date),
    gameId: String(row.game_id),
    pickedSide: row.picked_side === "home" ? "home" : "away",
    analysisMarkdown: String(row.analysis_markdown ?? ""),
    result:
      row.result === "win" || row.result === "loss"
        ? row.result
        : "pending",
    profitUnits: toNullableNumber(row.profit_units),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapDailyPickWithGame(row: Record<string, RowValue>): DailyPickWithGame {
  const pick = mapDailyPick(row);
  const hasGame = Boolean(row.g_id);

  return {
    ...pick,
    game: hasGame
      ? {
          id: String(row.g_id),
          date: String(row.g_date ?? pick.date),
          awayTeam: String(row.g_away_team ?? ""),
          awayDisplayName: String(row.g_away_display_name ?? ""),
          awayRecord: String(row.g_away_record ?? ""),
          awayLeader: String(row.g_away_leader ?? ""),
          awayLogo: String(row.g_away_logo ?? ""),
          homeTeam: String(row.g_home_team ?? ""),
          homeDisplayName: String(row.g_home_display_name ?? ""),
          homeRecord: String(row.g_home_record ?? ""),
          homeLeader: String(row.g_home_leader ?? ""),
          homeLogo: String(row.g_home_logo ?? ""),
          gameTimeEST: String(row.g_game_time_est ?? ""),
          status: row.g_status === "live" || row.g_status === "final" ? row.g_status : "upcoming",
          statusDetail: String(row.g_status_detail ?? ""),
          awayScore: toNullableNumber(row.g_away_score),
          homeScore: toNullableNumber(row.g_home_score),
          awayMoneyline: toNumber(row.g_away_moneyline),
          homeMoneyline: toNumber(row.g_home_moneyline),
          oddsSource:
            row.g_odds_source === "FanDuel" || row.g_odds_source === "BetMGM"
              ? row.g_odds_source
              : "DraftKings",
          spread: String(row.g_spread ?? ""),
          total: String(row.g_total ?? ""),
          broadcast: String(row.g_broadcast ?? ""),
          venue: String(row.g_venue ?? ""),
          gameUrl: String(row.g_game_url ?? ""),
          apiGameId: String(row.g_api_game_id ?? ""),
        }
      : null,
  };
}

function mapChatSession(row: Record<string, RowValue>): ChatSession {
  return {
    id: String(row.id),
    gameId: String(row.game_id),
    sessionToken: String(row.session_token),
    email: row.email ? String(row.email) : null,
    questionLimit: toNumber(row.question_limit),
    questionsUsed: toNumber(row.questions_used),
    isPaid: Boolean(row.is_paid),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapChatMessage(row: Record<string, RowValue>): ChatMessage {
  return {
    id: String(row.id),
    chatSessionId: String(row.chat_session_id),
    role: row.role === "assistant" ? "assistant" : "user",
    content: String(row.content ?? ""),
    createdAt: toIsoString(row.created_at),
  };
}

function mapCheckoutSession(row: Record<string, RowValue>): CheckoutSession {
  return {
    id: String(row.id),
    email: String(row.email),
    type:
      row.type === "match_chat" || row.type === "extra_questions"
        ? row.type
        : "daily_pick",
    amount: toNumber(row.amount),
    gameId: row.game_id ? String(row.game_id) : undefined,
    chatSessionId: row.chat_session_id ? String(row.chat_session_id) : undefined,
    status: row.status === "paid" ? "paid" : "pending",
    createdAt: toIsoString(row.created_at),
  };
}

function mapDataRefreshState(row: Record<string, RowValue>): DataRefreshState {
  return {
    key: String(row.key),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapPayment(row: Record<string, RowValue>): Payment {
  return {
    id: String(row.id),
    stripePaymentId: String(row.stripe_payment_id),
    stripeCustomerEmail: String(row.stripe_customer_email),
    type:
      row.type === "match_chat" || row.type === "extra_questions"
        ? row.type
        : "daily_pick",
    amount: toNumber(row.amount),
    status: row.status === "pending" || row.status === "failed" ? row.status : "paid",
    metadata: {
      gameId: row.game_id ? String(row.game_id) : undefined,
      chatSessionId: row.chat_session_id ? String(row.chat_session_id) : undefined,
    },
    grantedAt: toIsoString(row.granted_at),
  };
}

function emptyPrediction(date: string): DailyPrediction {
  const now = new Date().toISOString();
  return {
    id: `prediction-${date}`,
    date,
    teaserText: "",
    markdownContent: "",
    isNoEdgeDay: false,
    source: "auto",
    createdAt: now,
    updatedAt: now,
  };
}

function formatMoneyline(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatTrackRecordDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(parsed);
}

function formatProfitUnits(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  const normalized = Number(value);
  const sign = normalized > 0 ? "+" : normalized < 0 ? "-" : "";
  const absolute = Math.abs(normalized);
  const formatted = Number.isInteger(absolute) ? absolute.toFixed(1) : absolute.toString();
  return `${sign}${formatted}u`;
}

function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const bucket = groups.get(item.date);
    if (bucket) {
      bucket.push(item);
      continue;
    }

    groups.set(item.date, [item]);
  }

  return groups;
}

function groupGamesByDate(items: Game[]): Map<string, Game[]> {
  return groupByDate(items);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLookupText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTeamAliases(displayName: string, abbreviation: string): string[] {
  const normalizedDisplayName = normalizeLookupText(displayName);
  const normalizedAbbreviation = normalizeLookupText(abbreviation);
  const displayTokens = normalizedDisplayName.split(" ").filter(Boolean);
  const aliases = new Set<string>();

  if (normalizedAbbreviation) {
    aliases.add(normalizedAbbreviation);
  }

  if (normalizedDisplayName) {
    aliases.add(normalizedDisplayName);
  }

  for (let size = 1; size <= 3; size += 1) {
    if (displayTokens.length >= size) {
      aliases.add(displayTokens.slice(-size).join(" "));
    }
  }

  return [...aliases].filter((alias) => alias.length >= 2);
}

function countMatches(text: string, pattern: string): number {
  const regex = new RegExp(pattern, "gi");
  let count = 0;

  while (regex.exec(text)) {
    count += 1;
  }

  return count;
}

function scoreTeamMention(text: string, aliases: string[]): number {
  return aliases.reduce((score, alias) => {
    const escaped = escapeRegExp(alias);
    const mentionWeight = alias.length <= 3 ? 0.25 : 1;

    return score
      + (countMatches(text, `\\b${escaped}\\s+ml\\b`) * 12)
      + (countMatches(text, `\\b${escaped}\\b[^\\n.!?]{0,80}\\bmoneyline\\b`) * 8)
      + (countMatches(text, `\\b${escaped}\\b[^\\n.!?]{0,80}\\bhold(?:s)?\\b`) * 6)
      + (countMatches(text, `\\bonly actionable[^\\n.!?]{0,80}\\b${escaped}\\b`) * 6)
      + (countMatches(text, `\\bthe\\s+${escaped}\\b`) * 4)
      + (countMatches(text, `\\b${escaped}\\b`) * mentionWeight);
  }, 0);
}

function extractExplicitProfitUnits(text: string): number | null {
  const match = text.match(/([+-]\d+(?:\.\d+)?)u\b/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function isGameFinal(game: Game): boolean {
  if (game.status === "final") {
    return true;
  }

  return game.awayScore !== null
    && game.homeScore !== null
    && (game.awayScore > 0 || game.homeScore > 0);
}

function inferLegacyPredictionPick(
  prediction: DailyPrediction,
  games: Game[],
): { game: Game; pickedSide: "away" | "home" } | null {
  if (games.length === 0) {
    return null;
  }

  const text = normalizeLookupText(
    [
      prediction.teaserText,
      prediction.markdownContent
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith("### "))
        .join("\n"),
    ].filter(Boolean).join("\n"),
  );

  if (!text) {
    return null;
  }

  const candidates = games
    .flatMap((game) => {
      const awayAliases = buildTeamAliases(game.awayDisplayName, game.awayTeam);
      const homeAliases = buildTeamAliases(game.homeDisplayName, game.homeTeam);

      return [
        {
          game,
          pickedSide: "away" as const,
          score: scoreTeamMention(text, awayAliases),
        },
        {
          game,
          pickedSide: "home" as const,
          score: scoreTeamMention(text, homeAliases),
        },
      ];
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  const bestCandidate = candidates[0];
  if (!bestCandidate) {
    return null;
  }

  const secondCandidate = candidates[1];
  if (secondCandidate && bestCandidate.score <= secondCandidate.score) {
    return null;
  }

  return {
    game: bestCandidate.game,
    pickedSide: bestCandidate.pickedSide,
  };
}

function resolveLegacyPredictionTrackRecordEntry(
  prediction: DailyPrediction,
  games: Game[],
): TrackRecordResolvedEntry | null {
  const inferredPick = inferLegacyPredictionPick(prediction, games);
  if (!inferredPick || !isGameFinal(inferredPick.game)) {
    return null;
  }

  const { game, pickedSide } = inferredPick;
  if (game.awayScore === null || game.homeScore === null || game.awayScore === game.homeScore) {
    return null;
  }

  const pickedTeam = pickedSide === "away" ? game.awayTeam : game.homeTeam;
  const pickedMoneyline = pickedSide === "away" ? game.awayMoneyline : game.homeMoneyline;
  const pickedWon = pickedSide === "away" ? game.awayScore > game.homeScore : game.homeScore > game.awayScore;
  const matchup = pickedSide === "away"
    ? `**${game.awayTeam}** @ ${game.homeTeam}`
    : `${game.awayTeam} @ **${game.homeTeam}**`;
  const profitUnits = extractExplicitProfitUnits(prediction.markdownContent)
    ?? extractExplicitProfitUnits(prediction.teaserText);

  return {
    line: [
      formatTrackRecordDate(prediction.date),
      matchup,
      `${pickedTeam} ${formatMoneyline(pickedMoneyline)}`,
      `${pickedWon ? "W" : "L"} (${game.awayScore}-${game.homeScore})`,
      formatProfitUnits(profitUnits),
    ].filter(Boolean).join(" · "),
    result: pickedWon ? "win" : "loss",
    profitUnits,
  };
}

function amountForPayment(type: "daily_pick" | "match_chat" | "extra_questions"): number {
  if (type === "daily_pick") return 5;
  if (type === "match_chat") return 2;
  return 1;
}

function syntheticCheckoutEmail(id: string): string {
  return `guest+${id}@lockin.local`;
}

function getDate(dateTime: string): string {
  return getEstDateKey(new Date(dateTime));
}

async function hasActiveDailyPayment(email: string, date: string): Promise<boolean> {
  const payments = await getPaymentForEmail(email);
  return payments.some(
    (payment) =>
      payment.status === "paid" &&
      payment.type === "daily_pick" &&
      getDate(payment.grantedAt) === date,
  );
}

async function hasActiveChatPayment(email: string, sessionId: string): Promise<boolean> {
  const payments = await getPaymentForEmail(email);
  return payments.some(
    (payment) =>
      payment.status === "paid" &&
      payment.type !== "daily_pick" &&
      payment.metadata.chatSessionId === sessionId,
  );
}

export async function getTodayPrediction(date = getEstDateKey()): Promise<DailyPrediction> {
  const result = await query(
    `SELECT * FROM predictions WHERE date = $1 LIMIT 1`,
    [date],
  );

  if (!result.rows[0]) {
    return emptyPrediction(date);
  }

  return mapPrediction(result.rows[0] as Record<string, RowValue>);
}

export async function listPredictions(): Promise<DailyPrediction[]> {
  const result = await query(`SELECT * FROM predictions ORDER BY date DESC`);
  return result.rows.map((row) => mapPrediction(row as Record<string, RowValue>));
}

async function listPredictionsForDates(dates: string[]): Promise<DailyPrediction[]> {
  if (dates.length === 0) {
    return [];
  }

  const result = await query(
    `SELECT *
     FROM predictions
     WHERE date = ANY($1::text[])
     ORDER BY date DESC`,
    [dates],
  );

  return result.rows.map((row) => mapPrediction(row as Record<string, RowValue>));
}

export async function savePrediction(input: {
  id?: string;
  date: string;
  teaserText: string;
  markdownContent: string;
  isNoEdgeDay: boolean;
  source?: "auto" | "admin";
}): Promise<DailyPrediction> {
  const lookupParams = [];
  const conditions = [];

  if (input.id) {
    lookupParams.push(input.id);
    conditions.push(`id = $${lookupParams.length}`);
  }

  lookupParams.push(input.date);
  conditions.push(`date = $${lookupParams.length}`);

  const existing = await query(
    `SELECT * FROM predictions WHERE ${conditions.join(" OR ")} LIMIT 1`,
    lookupParams,
  );

  if (existing.rows[0]) {
    const updated = await query(
      `UPDATE predictions
         SET date = $2,
             teaser_text = $3,
             markdown_content = $4,
             is_no_edge_day = $5,
             source = $6,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        String(existing.rows[0].id),
        input.date,
        input.teaserText,
        input.markdownContent,
        input.isNoEdgeDay,
        input.source ?? "admin",
      ],
    );
    return mapPrediction(updated.rows[0] as Record<string, RowValue>);
  }

  const created = await query(
    `INSERT INTO predictions (
       id,
       date,
       teaser_text,
       markdown_content,
       is_no_edge_day,
       source,
       created_at,
       updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
    [
      crypto.randomUUID(),
      input.date,
      input.teaserText,
      input.markdownContent,
      input.isNoEdgeDay,
      input.source ?? "admin",
    ],
  );

  return mapPrediction(created.rows[0] as Record<string, RowValue>);
}

export async function deletePrediction(id: string): Promise<void> {
  await query(`DELETE FROM predictions WHERE id = $1`, [id]);
}

const DAILY_PICK_WITH_GAME_SELECT = `
  SELECT
    dp.*,
    g.id AS g_id,
    g.date AS g_date,
    g.away_team AS g_away_team,
    g.away_display_name AS g_away_display_name,
    g.away_record AS g_away_record,
    g.away_leader AS g_away_leader,
    g.away_logo AS g_away_logo,
    g.home_team AS g_home_team,
    g.home_display_name AS g_home_display_name,
    g.home_record AS g_home_record,
    g.home_leader AS g_home_leader,
    g.home_logo AS g_home_logo,
    g.game_time_est AS g_game_time_est,
    g.status AS g_status,
    g.status_detail AS g_status_detail,
    g.away_score AS g_away_score,
    g.home_score AS g_home_score,
    g.away_moneyline AS g_away_moneyline,
    g.home_moneyline AS g_home_moneyline,
    g.odds_source AS g_odds_source,
    g.spread AS g_spread,
    g.total AS g_total,
    g.broadcast AS g_broadcast,
    g.venue AS g_venue,
    g.game_url AS g_game_url,
    g.api_game_id AS g_api_game_id
  FROM daily_picks dp
  LEFT JOIN games g ON g.id = dp.game_id
`;

function buildDailyEdgePreview(date: string, prediction: DailyPrediction | null, picks: DailyPick[]): DailyEdgePreview {
  const isNoEdgeDay = Boolean(prediction?.source === "admin" && prediction.isNoEdgeDay);
  const pickCount = picks.length;
  const status = isNoEdgeDay
    ? "no_edge"
    : pickCount > 0
      ? "ready"
      : "pending";

  return {
    date,
    status,
    hasPrediction: status === "ready",
    isNoEdgeDay,
    pickCount,
  };
}

function mapSlateSummary(row: Record<string, RowValue>): DailySlateSummary {
  const pickCount = toNumber(row.pick_count);
  const isNoEdgeDay = Boolean(row.is_no_edge_day);
  const status = isNoEdgeDay
    ? "no_edge"
    : pickCount > 0
      ? "ready"
      : "pending";

  return {
    date: String(row.date),
    status,
    isNoEdgeDay,
    pickCount,
    updatedAt: toIsoString(row.updated_at),
  };
}

function buildDailyPickShareMarkdown(picks: DailyPickWithGame[]): string {
  return picks
    .filter((pick) => pick.game)
    .map((pick) => {
      const game = pick.game as Game;
      const pickedTeam = pick.pickedSide === "away" ? game.awayTeam : game.homeTeam;
      const pickedMoneyline = pick.pickedSide === "away" ? game.awayMoneyline : game.homeMoneyline;
      const analysis = pick.analysisMarkdown.trim();

      return [
        `### ${pickedTeam} ML ${formatMoneyline(pickedMoneyline)}`,
        `${game.awayTeam} @ ${game.homeTeam} • ${game.status === "upcoming" ? "Tonight" : game.statusDetail || "Live board"}`,
        analysis || "The edge is live inside LOCKIN.",
      ].join("\n\n");
    })
    .join("\n\n");
}

function buildTrackRecordLine(pick: DailyPickWithGame): string | null {
  if (!pick.game || pick.result === "pending") {
    return null;
  }

  const game = pick.game;
  const pickedTeam = pick.pickedSide === "away" ? game.awayTeam : game.homeTeam;
  const matchup = pick.pickedSide === "away"
    ? `**${game.awayTeam}** @ ${game.homeTeam}`
    : `${game.awayTeam} @ **${game.homeTeam}**`;
  const pickedMoneyline = pick.pickedSide === "away" ? game.awayMoneyline : game.homeMoneyline;
  const score =
    game.awayScore !== null && game.homeScore !== null
      ? ` (${game.awayScore}-${game.homeScore})`
      : "";
  const profit = formatProfitUnits(pick.profitUnits);

  return [
    formatTrackRecordDate(pick.date),
    matchup,
    `${pickedTeam} ${formatMoneyline(pickedMoneyline)}`,
    pick.result === "win" ? `W${score}` : `L${score}`,
    profit,
  ].filter(Boolean).join(" · ");
}

export async function listDailyPicksForDate(date = getEstDateKey()): Promise<DailyPick[]> {
  const result = await query(
    `SELECT * FROM daily_picks WHERE date = $1 ORDER BY created_at ASC, id ASC`,
    [date],
  );

  return result.rows.map((row) => mapDailyPick(row as Record<string, RowValue>));
}

export async function listDailyPicksWithGamesForDate(date = getEstDateKey()): Promise<DailyPickWithGame[]> {
  const result = await query(
    `${DAILY_PICK_WITH_GAME_SELECT}
     WHERE dp.date = $1
     ORDER BY COALESCE(g.game_time_est, dp.created_at::text) ASC, dp.created_at ASC, dp.id ASC`,
    [date],
  );

  return result.rows.map((row) => mapDailyPickWithGame(row as Record<string, RowValue>));
}

export async function listDailyPicksWithGamesForDates(dates: string[]): Promise<DailyPickWithGame[]> {
  if (dates.length === 0) {
    return [];
  }

  const result = await query(
    `${DAILY_PICK_WITH_GAME_SELECT}
     WHERE dp.date = ANY($1::text[])
     ORDER BY dp.date DESC, COALESCE(g.game_time_est, dp.created_at::text) ASC, dp.created_at ASC, dp.id ASC`,
    [dates],
  );

  return result.rows.map((row) => mapDailyPickWithGame(row as Record<string, RowValue>));
}

async function listGamesForDates(dates: string[]): Promise<Game[]> {
  if (dates.length === 0) {
    return [];
  }

  const result = await query(
    `SELECT *
     FROM games
     WHERE date = ANY($1::text[])
     ORDER BY date DESC, CASE WHEN status = 'final' THEN 1 ELSE 0 END ASC, game_time_est ASC`,
    [dates],
  );

  return result.rows.map((row) => mapGame(row as Record<string, RowValue>));
}

export async function getPublicDailyEdgePreview(date = getEstDateKey()): Promise<DailyEdgePreview> {
  const [prediction, picks] = await Promise.all([
    getTodayPrediction(date).catch(() => null),
    listDailyPicksForDate(date),
  ]);

  return buildDailyEdgePreview(date, prediction, picks);
}

export async function listDailySlateSummaries(limit = 21): Promise<DailySlateSummary[]> {
  const result = await query(
    `SELECT
       p.date,
       p.is_no_edge_day,
       p.updated_at,
       COUNT(dp.id) AS pick_count
     FROM predictions p
     LEFT JOIN daily_picks dp ON dp.date = p.date
     WHERE p.source = 'admin'
     GROUP BY p.date, p.is_no_edge_day, p.updated_at
     ORDER BY p.date DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => mapSlateSummary(row as Record<string, RowValue>));
}

async function listTrackRecordSlateSummaries(limit = 21): Promise<DailySlateSummary[]> {
  const result = await query(
    `SELECT
       p.date,
       p.is_no_edge_day,
       p.updated_at,
       COUNT(dp.id) AS pick_count
     FROM predictions p
     LEFT JOIN daily_picks dp ON dp.date = p.date
     GROUP BY p.date, p.is_no_edge_day, p.updated_at
     ORDER BY p.date DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => mapSlateSummary(row as Record<string, RowValue>));
}

export async function saveDailyPickSlate(
  date: string,
  input: {
    isNoEdgeDay: boolean;
    picks: Array<{
      gameId: string;
      pickedSide: "away" | "home";
      analysisMarkdown?: string;
      result?: "pending" | "win" | "loss";
      profitUnits?: number | null;
    }>;
  },
): Promise<{
  preview: DailyEdgePreview;
  picks: DailyPickWithGame[];
}> {
  const normalizedPicks = Array.from(
    input.picks.reduce<Map<string, {
      gameId: string;
      pickedSide: "away" | "home";
      analysisMarkdown: string;
      result: "pending" | "win" | "loss";
      profitUnits: number | null;
    }>>((acc, pick) => {
      const gameId = pick.gameId.trim();
      if (!gameId) {
        return acc;
      }

      acc.set(gameId, {
        gameId,
        pickedSide: pick.pickedSide === "home" ? "home" : "away",
        analysisMarkdown: pick.analysisMarkdown?.trim() || "",
        result:
          pick.result === "win" || pick.result === "loss"
            ? pick.result
            : "pending",
        profitUnits:
          typeof pick.profitUnits === "number" && Number.isFinite(pick.profitUnits)
            ? Number(pick.profitUnits)
            : null,
      });
      return acc;
    }, new Map()).values(),
  );
  const isNoEdgeDay = input.isNoEdgeDay && normalizedPicks.length === 0;

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM daily_picks WHERE date = $1`, [date]);

    for (const pick of normalizedPicks) {
      await client.query(
        `INSERT INTO daily_picks (
           id,
           date,
           game_id,
           picked_side,
           analysis_markdown,
           result,
           profit_units,
           created_at,
           updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          date,
          pick.gameId,
          pick.pickedSide,
          pick.analysisMarkdown,
          pick.result,
          pick.profitUnits,
        ],
      );
    }

    if (normalizedPicks.length === 0 && !isNoEdgeDay) {
      await client.query(`DELETE FROM predictions WHERE date = $1`, [date]);
      return;
    }

    await client.query(
      `INSERT INTO predictions (
         id,
         date,
         teaser_text,
         markdown_content,
         is_no_edge_day,
         source,
         created_at,
         updated_at
       ) VALUES ($1, $2, '', '', $3, 'admin', NOW(), NOW())
       ON CONFLICT (date) DO UPDATE
         SET teaser_text = EXCLUDED.teaser_text,
             markdown_content = EXCLUDED.markdown_content,
             is_no_edge_day = EXCLUDED.is_no_edge_day,
             source = 'admin',
             updated_at = NOW()`,
      [crypto.randomUUID(), date, isNoEdgeDay],
    );
  });

  const picks = await listDailyPicksWithGamesForDate(date);
  return {
    preview: buildDailyEdgePreview(date, await getTodayPrediction(date).catch(() => null), picks),
    picks,
  };
}

export async function buildAutomaticTrackRecordMarkdown(limit = 21): Promise<string> {
  const slates = await listTrackRecordSlateSummaries(limit);
  if (slates.length === 0) {
    return "";
  }

  const dates = slates.map((slate) => slate.date);
  const [picks, predictions, games] = await Promise.all([
    listDailyPicksWithGamesForDates(dates),
    listPredictionsForDates(dates),
    listGamesForDates(dates),
  ]);
  const picksByDate = groupByDate(picks);
  const predictionsByDate = new Map(predictions.map((prediction) => [prediction.date, prediction]));
  const gamesByDate = groupGamesByDate(games);
  const weeklyCutoff = getEstDateKey(new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)));

  let wins = 0;
  let losses = 0;
  let totalUnits = 0;
  let weeklyResolvedUnits = 0;
  const lines: string[] = [];
  const legacyDatesNeedingRefresh = slates
    .filter((slate) => {
      const hasDailyPickRows = (picksByDate.get(slate.date) || []).length > 0;
      const prediction = predictionsByDate.get(slate.date);

      return !hasDailyPickRows && Boolean(prediction && !prediction.isNoEdgeDay);
    })
    .map((slate) => slate.date);

  if (legacyDatesNeedingRefresh.length > 0) {
    const refreshedLegacyGames = await Promise.all(
      legacyDatesNeedingRefresh.map(async (date) => {
        const cachedGames = gamesByDate.get(date) || [];
        const needsRefresh = cachedGames.length === 0 || cachedGames.some((game) => !isGameFinal(game));

        if (!needsRefresh) {
          return [date, cachedGames] as const;
        }

        try {
          const latestGames = await fetchTodayGames(date);
          return [date, mergeLatestGames(cachedGames, latestGames)] as const;
        } catch {
          return [date, cachedGames] as const;
        }
      }),
    );

    for (const [date, refreshedGames] of refreshedLegacyGames) {
      gamesByDate.set(date, refreshedGames);
    }
  }

  for (const slate of slates) {
    const registerWeeklyOutcome = (result: "win" | "loss", profitUnits: number | null) => {
      if (slate.date < weeklyCutoff) {
        return;
      }

      if (result === "win") {
        wins += 1;
      } else {
        losses += 1;
      }

      if (profitUnits !== null) {
        totalUnits += profitUnits;
        weeklyResolvedUnits += 1;
      }
    };

    const datePicks = picksByDate.get(slate.date) || [];
    const completedLines = datePicks
      .map((pick) => {
        if (pick.result !== "pending") {
          registerWeeklyOutcome(pick.result, pick.profitUnits);
        }

        return buildTrackRecordLine(pick);
      })
      .filter((line): line is string => Boolean(line));

    if (completedLines.length > 0) {
      lines.push(...completedLines);
      continue;
    }

    const prediction = predictionsByDate.get(slate.date);
    if (prediction && !prediction.isNoEdgeDay) {
      const legacyEntry = resolveLegacyPredictionTrackRecordEntry(
        prediction,
        gamesByDate.get(slate.date) || [],
      );

      if (legacyEntry) {
        registerWeeklyOutcome(legacyEntry.result, legacyEntry.profitUnits);
        lines.push(legacyEntry.line);
        continue;
      }
    }

    if (slate.isNoEdgeDay) {
      lines.push(`${formatTrackRecordDate(slate.date)} · PASS — No edge detected`);
    }
  }

  if (lines.length === 0) {
    return "";
  }

  const decidedCount = wins + losses;
  const winRate = decidedCount > 0 ? Math.round((wins / decidedCount) * 100) : 0;
  const summary = decidedCount > 0
    ? [
        `### This Week: ${wins}-${losses}`,
        weeklyResolvedUnits === decidedCount ? formatProfitUnits(totalUnits) : null,
        `${winRate}% Win Rate`,
      ].filter(Boolean).join(" | ")
    : "";

  return [summary, ...lines].filter(Boolean).join("\n");
}

export async function getResolvedTrackRecordMarkdown(): Promise<string> {
  const [automaticMarkdown, siteCopy] = await Promise.all([
    buildAutomaticTrackRecordMarkdown(),
    getSiteCopy(),
  ]);

  if (automaticMarkdown) {
    const automaticRecord = parseTrackRecordMarkdown(automaticMarkdown);
    const hasDecidedResults = automaticRecord.entries.some((entry) => entry.outcome === "win" || entry.outcome === "loss");

    if (hasDecidedResults || !siteCopy.trackRecordMarkdown.trim()) {
      return automaticMarkdown;
    }
  }

  return siteCopy.trackRecordMarkdown;
}

export async function getUnlockedDailyEdge(date = getEstDateKey()): Promise<{
  preview: DailyEdgePreview;
  picks: DailyPickWithGame[];
  markdown: string;
}> {
  const [prediction, picks] = await Promise.all([
    getTodayPrediction(date).catch(() => null),
    listDailyPicksWithGamesForDate(date),
  ]);
  const preview = buildDailyEdgePreview(date, prediction, picks);

  return {
    preview,
    picks,
    markdown: buildDailyPickShareMarkdown(picks),
  };
}

export async function getSocialProofBanner(): Promise<SocialProofBanner | null> {
  const result = await query(`SELECT * FROM social_proof_banner WHERE id = 'default' LIMIT 1`);
  if (!result.rows[0]) {
    return null;
  }

  const banner = mapSocialProofBanner(result.rows[0] as Record<string, RowValue>);
  if (!banner.isActive || banner.messages.length === 0) {
    return null;
  }

  return banner;
}

export async function getPublicSocialProofMessages(): Promise<string[]> {
  const [trackRecordMarkdown, banner] = await Promise.all([getResolvedTrackRecordMarkdown(), getSocialProofBanner()]);
  const summary = extractTrackRecordSummary(trackRecordMarkdown);
  const baseMessages = banner?.messages?.length ? banner.messages : [...DEFAULT_SOCIAL_PROOF_MESSAGES];

  if (!summary) {
    return baseMessages;
  }

  return [summary, ...baseMessages.filter((message) => message.trim() && message.trim() !== summary)];
}

export async function setSocialProofBanner(input: string[] | string): Promise<SocialProofBanner> {
  const messages = normalizeMessages(Array.isArray(input) ? JSON.stringify(input) : input);
  const text = messages[0] || "";
  const result = await query(
    `INSERT INTO social_proof_banner (id, text, messages_json, is_active, updated_at)
     VALUES ('default', $1, $2::jsonb, $3, NOW())
     ON CONFLICT (id) DO UPDATE
       SET text = EXCLUDED.text,
           messages_json = EXCLUDED.messages_json,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
     RETURNING *`,
    [text, JSON.stringify(messages), messages.length > 0],
  );

  return mapSocialProofBanner(result.rows[0] as Record<string, RowValue>);
}

export async function getSiteCopy(): Promise<SiteCopy> {
  const result = await query(`SELECT * FROM site_copy WHERE id = 'default' LIMIT 1`);

  if (!result.rows[0]) {
    return {
      id: "default",
      ...DEFAULT_SITE_COPY_CONTENT,
      updatedAt: new Date().toISOString(),
    };
  }

  return mapSiteCopy(result.rows[0] as Record<string, RowValue>);
}

export async function setSiteCopy(input: {
  dailyCtaText?: string;
  dailyPriceSubtext?: string;
  noEdgeMessage?: string;
  headerRightText?: string;
  metaDescription?: string;
  footerDisclaimer?: string;
  trackRecordMarkdown?: string;
}): Promise<SiteCopy> {
  const current = await getSiteCopy();
  const next = {
    dailyCtaText: input.dailyCtaText?.trim() || DEFAULT_SITE_COPY_CONTENT.dailyCtaText,
    dailyPriceSubtext: input.dailyPriceSubtext?.trim() || DEFAULT_SITE_COPY_CONTENT.dailyPriceSubtext,
    noEdgeMessage: input.noEdgeMessage?.trim() || DEFAULT_SITE_COPY_CONTENT.noEdgeMessage,
    headerRightText: input.headerRightText?.trim() || "",
    metaDescription: input.metaDescription?.trim() || DEFAULT_SITE_COPY_CONTENT.metaDescription,
    footerDisclaimer: input.footerDisclaimer?.trim() || DEFAULT_SITE_COPY_CONTENT.footerDisclaimer,
    trackRecordMarkdown:
      input.trackRecordMarkdown?.trim() ??
      current.trackRecordMarkdown ??
      DEFAULT_SITE_COPY_CONTENT.trackRecordMarkdown,
  };

  const result = await query(
    `INSERT INTO site_copy (
       id,
       daily_cta_text,
       daily_price_subtext,
       no_edge_message,
       header_right_text,
       meta_description,
       footer_disclaimer,
       track_record_markdown,
       updated_at
     ) VALUES ('default', $1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE
       SET daily_cta_text = EXCLUDED.daily_cta_text,
           daily_price_subtext = EXCLUDED.daily_price_subtext,
           no_edge_message = EXCLUDED.no_edge_message,
           header_right_text = EXCLUDED.header_right_text,
           meta_description = EXCLUDED.meta_description,
           footer_disclaimer = EXCLUDED.footer_disclaimer,
           track_record_markdown = EXCLUDED.track_record_markdown,
           updated_at = NOW()
     RETURNING *`,
    [
      next.dailyCtaText || current.dailyCtaText,
      next.dailyPriceSubtext || current.dailyPriceSubtext,
      next.noEdgeMessage || current.noEdgeMessage,
      next.headerRightText,
      next.metaDescription || current.metaDescription,
      next.footerDisclaimer || current.footerDisclaimer,
      next.trackRecordMarkdown,
    ],
  );

  return mapSiteCopy(result.rows[0] as Record<string, RowValue>);
}

export async function getPromoBanner(): Promise<PromoBanner> {
  const result = await query(`SELECT * FROM promo_banner WHERE id = 'default' LIMIT 1`);

  if (!result.rows[0]) {
    return {
      ...DEFAULT_PROMO_BANNER,
      updatedAt: new Date().toISOString(),
    };
  }

  return mapPromoBanner(result.rows[0] as Record<string, RowValue>);
}

export async function setPromoBanner(input: {
  isActive?: boolean;
  bannerText?: string;
  endDatetime?: string;
}): Promise<PromoBanner> {
  const current = await getPromoBanner();
  const nextIsActive = input.isActive ?? current.isActive;
  const requestedEndDatetime = input.endDatetime?.trim() || current.endDatetime || "";
  const requestedEndsAt = requestedEndDatetime ? new Date(requestedEndDatetime).getTime() : Number.NaN;
  const nextEndDatetime =
    nextIsActive && (!requestedEndDatetime || Number.isNaN(requestedEndsAt) || requestedEndsAt <= Date.now())
      ? getDefaultPromoEndDatetime()
      : requestedEndDatetime;
  const next = {
    isActive: nextIsActive,
    bannerText: input.bannerText?.trim() || current.bannerText || DEFAULT_PROMO_BANNER.bannerText,
    endDatetime: nextEndDatetime,
  };

  const result = await query(
    `INSERT INTO promo_banner (
       id,
       is_active,
       banner_text,
       end_datetime,
       created_at,
       updated_at
     ) VALUES ('default', $1, $2, NULLIF($3, '')::timestamptz, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE
       SET is_active = EXCLUDED.is_active,
           banner_text = EXCLUDED.banner_text,
           end_datetime = EXCLUDED.end_datetime,
           updated_at = NOW()
     RETURNING *`,
    [next.isActive, next.bannerText, next.endDatetime],
  );

  return mapPromoBanner(result.rows[0] as Record<string, RowValue>);
}

export async function getActivePromoBanner(): Promise<PromoBanner | null> {
  const banner = await getPromoBanner();
  if (!banner.isActive || !banner.endDatetime) {
    return null;
  }

  const endsAt = new Date(banner.endDatetime).getTime();
  if (Number.isNaN(endsAt) || endsAt <= Date.now()) {
    return null;
  }

  return banner;
}

export async function listMatchMarkdownsForDate(date = getEstDateKey()): Promise<MatchMarkdown[]> {
  const result = await query(
    `SELECT * FROM match_markdowns WHERE date = $1 ORDER BY created_at ASC, id ASC`,
    [date],
  );

  return result.rows.map((row) => mapMatchMarkdown(row as Record<string, RowValue>));
}

export async function getMatchMarkdown(gameId: string, date = getEstDateKey()): Promise<MatchMarkdown | null> {
  const result = await query(
    `SELECT * FROM match_markdowns WHERE game_id = $1 AND date = $2 LIMIT 1`,
    [gameId, date],
  );

  return result.rows[0] ? mapMatchMarkdown(result.rows[0] as Record<string, RowValue>) : null;
}

export async function saveMatchMarkdowns(
  date: string,
  entries: Array<{ gameId: string; markdownContent: string }>,
): Promise<MatchMarkdown[]> {
  return withTransaction(async (client) => {
    for (const entry of entries) {
      const markdownContent = entry.markdownContent.trim();
      if (!entry.gameId) {
        continue;
      }

      if (!markdownContent) {
        await client.query(
          `DELETE FROM match_markdowns WHERE game_id = $1 AND date = $2`,
          [entry.gameId, date],
        );
        continue;
      }

      await client.query(
        `INSERT INTO match_markdowns (id, game_id, date, markdown_content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (game_id, date) DO UPDATE
           SET markdown_content = EXCLUDED.markdown_content,
               updated_at = NOW()`,
        [crypto.randomUUID(), entry.gameId, date, markdownContent],
      );
    }

    const result = await client.query(
      `SELECT * FROM match_markdowns WHERE date = $1 ORDER BY created_at ASC, id ASC`,
      [date],
    );

    return result.rows.map((row) => mapMatchMarkdown(row as Record<string, RowValue>));
  });
}

export async function getActiveSystemPrompt(): Promise<SystemPrompt> {
  const active = await query(
    `SELECT * FROM system_prompts WHERE is_active = TRUE ORDER BY version DESC LIMIT 1`,
  );

  if (active.rows[0]) {
    return mapSystemPrompt(active.rows[0] as Record<string, RowValue>);
  }

  const fallback = await query(`SELECT * FROM system_prompts ORDER BY version DESC LIMIT 1`);
  return mapSystemPrompt(fallback.rows[0] as Record<string, RowValue>);
}

export async function listSystemPrompts(limit = 5): Promise<SystemPrompt[]> {
  const result = await query(
    `SELECT * FROM system_prompts ORDER BY version DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => mapSystemPrompt(row as Record<string, RowValue>));
}

export async function saveSystemPrompt(content: string): Promise<SystemPrompt> {
  return withTransaction(async (client) => {
    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version), 0) AS max_version FROM system_prompts`,
    );
    const nextVersion = toNumber(versionResult.rows[0].max_version) + 1;

    await client.query(`UPDATE system_prompts SET is_active = FALSE WHERE is_active = TRUE`);

    const created = await client.query(
      `INSERT INTO system_prompts (id, content, version, is_active, created_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       RETURNING *`,
      [crypto.randomUUID(), content, nextVersion],
    );

    await client.query(
      `DELETE FROM system_prompts
       WHERE id IN (
         SELECT id
         FROM system_prompts
         ORDER BY version DESC
         OFFSET 10
       )`,
    );

    return mapSystemPrompt(created.rows[0] as Record<string, RowValue>);
  });
}

export async function getGames(date = getEstDateKey()): Promise<Game[]> {
  const result = await query(
    `SELECT *
     FROM games
     WHERE date = $1
     ORDER BY CASE WHEN status = 'final' THEN 1 ELSE 0 END ASC, game_time_est ASC`,
    [date],
  );
  return result.rows.map((row) => mapGame(row as Record<string, RowValue>));
}

export async function getGamesRefreshState(date = getEstDateKey()): Promise<DataRefreshState | null> {
  const result = await query(
    `SELECT * FROM data_refresh_state WHERE key = $1 LIMIT 1`,
    [`games:${date}`],
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapDataRefreshState(result.rows[0] as Record<string, RowValue>);
}

export async function setGames(date: string, games: Game[]): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM games WHERE date = $1`, [date]);

    if (games.length === 0) {
      return;
    }

    const values: Array<string | number | null> = [];
    const rows = games.map((game, index) => {
      const offset = index * 26;
      values.push(
        game.id,
        date,
        game.awayTeam,
        game.awayDisplayName,
        game.awayRecord,
        game.awayLeader,
        game.awayLogo,
        game.homeTeam,
        game.homeDisplayName,
        game.homeRecord,
        game.homeLeader,
        game.homeLogo,
        game.gameTimeEST,
        game.status,
        game.statusDetail,
        game.awayScore,
        game.homeScore,
        game.awayMoneyline,
        game.homeMoneyline,
        game.oddsSource,
        game.spread,
        game.total,
        game.broadcast,
        game.venue,
        game.gameUrl,
        game.apiGameId,
      );

      return `(
        $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7},
        $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13},
        $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19},
        $${offset + 20}, $${offset + 21}, $${offset + 22}, $${offset + 23}, $${offset + 24}, $${offset + 25},
        $${offset + 26}
      )`;
    });

    await client.query(
      `INSERT INTO games (
         id,
         date,
         away_team,
         away_display_name,
         away_record,
         away_leader,
         away_logo,
         home_team,
         home_display_name,
         home_record,
         home_leader,
         home_logo,
         game_time_est,
         status,
         status_detail,
         away_score,
         home_score,
         away_moneyline,
         home_moneyline,
         odds_source,
         spread,
         total,
         broadcast,
         venue,
         game_url,
         api_game_id
       ) VALUES ${rows.join(",")}`,
      values,
    );
  });
}

export async function touchGamesRefreshState(date: string): Promise<DataRefreshState> {
  const result = await query(
    `INSERT INTO data_refresh_state (key, updated_at)
     VALUES ($1, NOW())
     ON CONFLICT (key) DO UPDATE
       SET updated_at = NOW()
     RETURNING *`,
    [`games:${date}`],
  );

  return mapDataRefreshState(result.rows[0] as Record<string, RowValue>);
}

export async function findChatSessionForEmailGame(
  gameId: string,
  email: string,
  date = getEstDateKey(),
): Promise<ChatSession | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const result = await query(
    `SELECT *
     FROM chat_sessions
     WHERE game_id = $1
       AND LOWER(email) = LOWER($2)
       AND (created_at AT TIME ZONE 'America/New_York')::date = $3::date
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [gameId, normalizedEmail, date],
  );

  return result.rows[0] ? mapChatSession(result.rows[0] as Record<string, RowValue>) : null;
}

export async function createChatSession(gameId: string, email?: string | null): Promise<ChatSession> {
  const normalizedEmail = email?.trim().toLowerCase() || "";
  if (normalizedEmail) {
    const existing = await findChatSessionForEmailGame(gameId, normalizedEmail);
    if (existing) {
      return existing;
    }
  }

  const created = await query(
    `INSERT INTO chat_sessions (
       id,
       game_id,
       session_token,
       email,
       question_limit,
       questions_used,
       is_paid,
       created_at,
       updated_at
     ) VALUES ($1, $2, $3, $4, 0, 0, FALSE, NOW(), NOW())
     RETURNING *`,
    [crypto.randomUUID(), gameId, crypto.randomUUID(), normalizedEmail || null],
  );

  return mapChatSession(created.rows[0] as Record<string, RowValue>);
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const result = await query(`SELECT * FROM chat_sessions WHERE id = $1 LIMIT 1`, [sessionId]);
  return result.rows[0] ? mapChatSession(result.rows[0] as Record<string, RowValue>) : null;
}

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const result = await query(
    `SELECT * FROM chat_messages WHERE chat_session_id = $1 ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return result.rows.map((row) => mapChatMessage(row as Record<string, RowValue>));
}

export async function addChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<ChatMessage> {
  const created = await query(
    `INSERT INTO chat_messages (id, chat_session_id, role, content, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [crypto.randomUUID(), sessionId, role, content],
  );

  return mapChatMessage(created.rows[0] as Record<string, RowValue>);
}

export async function touchSession(
  sessionId: string,
  data: Partial<Pick<ChatSession, "questionLimit" | "questionsUsed" | "isPaid" | "email">>,
): Promise<void> {
  const updates = ["updated_at = NOW()"];
  const values: Array<string | number | boolean | null> = [];

  if (data.questionLimit !== undefined) {
    values.push(data.questionLimit);
    updates.push(`question_limit = $${values.length}`);
  }

  if (data.questionsUsed !== undefined) {
    values.push(data.questionsUsed);
    updates.push(`questions_used = $${values.length}`);
  }

  if (data.isPaid !== undefined) {
    values.push(data.isPaid);
    updates.push(`is_paid = $${values.length}`);
  }

  if (data.email !== undefined) {
    values.push(data.email);
    updates.push(`email = $${values.length}`);
  }

  values.push(sessionId);
  await query(
    `UPDATE chat_sessions SET ${updates.join(", ")} WHERE id = $${values.length}`,
    values,
  );
}

export async function consumeChatQuestion(sessionId: string, email?: string | null): Promise<ChatSession | null> {
  const result = await query(
    `UPDATE chat_sessions
     SET questions_used = questions_used + 1,
         email = COALESCE($2, email),
         updated_at = NOW()
     WHERE id = $1
       AND is_paid = TRUE
       AND questions_used < question_limit
     RETURNING *`,
    [sessionId, email?.trim().toLowerCase() || null],
  );

  return result.rows[0] ? mapChatSession(result.rows[0] as Record<string, RowValue>) : null;
}

export async function hasChatCapacity(sessionId: string): Promise<boolean> {
  const result = await query(
    `SELECT question_limit, questions_used FROM chat_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  );

  if (!result.rows[0]) {
    return false;
  }

  return toNumber(result.rows[0].questions_used) < toNumber(result.rows[0].question_limit);
}

export async function remainingQuestions(sessionId: string): Promise<number> {
  const result = await query(
    `SELECT question_limit, questions_used FROM chat_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  );

  if (!result.rows[0]) {
    return 0;
  }

  return Math.max(0, toNumber(result.rows[0].question_limit) - toNumber(result.rows[0].questions_used));
}

export async function createCheckoutSession(input: {
  email?: string;
  type: "daily_pick" | "match_chat" | "extra_questions";
  gameId?: string;
  chatSessionId?: string;
}): Promise<{ id: string; amount: number }> {
  const id = crypto.randomUUID();
  const amount = amountForPayment(input.type);
  const email = input.email?.trim().toLowerCase() || syntheticCheckoutEmail(id);

  await query(
    `INSERT INTO checkout_sessions (
       id,
       email,
       type,
       amount,
       game_id,
       chat_session_id,
       status,
       created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())`,
    [id, email, input.type, amount, input.gameId ?? null, input.chatSessionId ?? null],
  );

  return { id, amount };
}

export async function getCheckoutSession(id: string): Promise<CheckoutSession | null> {
  const result = await query(`SELECT * FROM checkout_sessions WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0] ? mapCheckoutSession(result.rows[0] as Record<string, RowValue>) : null;
}

export async function completeCheckout(
  sessionId: string,
  paymentId: string,
  customerEmail?: string | null,
): Promise<Payment | null> {
  return withTransaction(async (client) => {
    const checkoutResult = await client.query(
      `SELECT * FROM checkout_sessions WHERE id = $1 FOR UPDATE`,
      [sessionId],
    );
    const checkoutRow = checkoutResult.rows[0] as Record<string, RowValue> | undefined;

    if (!checkoutRow || checkoutRow.status === "paid") {
      return null;
    }

    const checkout = mapCheckoutSession(checkoutRow);
    const normalizedEmail = customerEmail?.trim().toLowerCase() || checkout.email;

    await client.query(
      `UPDATE checkout_sessions
       SET status = 'paid',
           email = $2
       WHERE id = $1`,
      [sessionId, normalizedEmail],
    );

    const createdPayment = await client.query(
      `INSERT INTO payments (
         id,
         stripe_payment_id,
         stripe_customer_email,
         type,
         amount,
         status,
         game_id,
         chat_session_id,
         granted_at
       ) VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7, NOW())
       RETURNING *`,
      [
        crypto.randomUUID(),
        paymentId,
        normalizedEmail,
        checkout.type,
        checkout.amount,
        checkout.gameId ?? null,
        checkout.chatSessionId ?? null,
      ],
    );

    if (checkout.type === "match_chat" && checkout.chatSessionId) {
      await client.query(
        `UPDATE chat_sessions
         SET is_paid = TRUE,
             question_limit = GREATEST(3, question_limit),
             email = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [checkout.chatSessionId, normalizedEmail],
      );
    }

    if (checkout.type === "extra_questions" && checkout.chatSessionId) {
      await client.query(
        `UPDATE chat_sessions
         SET question_limit = question_limit + 3,
             email = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [checkout.chatSessionId, normalizedEmail],
      );
    }

    return mapPayment(createdPayment.rows[0] as Record<string, RowValue>);
  });
}

export async function validateDailyToken(email: string): Promise<boolean> {
  return hasActiveDailyPayment(email, getEstDateKey());
}

export async function createMagicLink(email: string): Promise<string | null> {
  const today = getEstDateKey();
  if (!(await hasActiveDailyPayment(email, today))) {
    return null;
  }

  const token = crypto.randomBytes(24).toString("hex");
  await query(
    `INSERT INTO magic_links (id, email, token, expires_at, is_used, created_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', FALSE, NOW())`,
    [crypto.randomUUID(), email, token],
  );

  return token;
}

export async function consumeMagicLink(token: string): Promise<{ email: string } | null> {
  const result = await query(
    `UPDATE magic_links
     SET is_used = TRUE
     WHERE token = $1
       AND is_used = FALSE
       AND expires_at >= NOW()
     RETURNING email`,
    [token],
  );

  if (!result.rows[0]) {
    return null;
  }

  return { email: String(result.rows[0].email) };
}

export async function getPaymentForEmail(email: string): Promise<Payment[]> {
  const result = await query(
    `SELECT *
     FROM payments
     WHERE LOWER(stripe_customer_email) = LOWER($1)
     ORDER BY granted_at DESC`,
    [email],
  );

  return result.rows.map((row) => mapPayment(row as Record<string, RowValue>));
}

export async function getAccessState(
  email: string,
  sessionId?: string,
): Promise<{
  daily: boolean;
  chat: boolean;
}> {
  return {
    daily: await validateDailyToken(email),
    chat: sessionId ? await hasActiveChatPayment(email, sessionId) : false,
  };
}
