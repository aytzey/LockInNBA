import crypto from "node:crypto";
import { query, withTransaction } from "./db";
import {
  ChatMessage,
  ChatSession,
  DailyPrediction,
  Game,
  Payment,
  SiteCopy,
  SocialProofBanner,
  SystemPrompt,
} from "./types";
import { getEstDateKey } from "./time";

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

export const DEFAULT_SOCIAL_PROOF_TEXT = "This Week: 5-0 (100%) | +19.3u ROI";
export const DEFAULT_NO_EDGE_BANNER_PREFIX = "Today: No Edge — Protecting Your Bankroll";

const DEFAULT_SITE_COPY_CONTENT = {
  dailyCtaText: "Unlock Tonight's Edge — $5",
  noEdgeMessage: "We passed on 90% of this week's games. We only bet when the math screams.",
  headerRightText: "",
  footerDisclaimer:
    "For entertainment purposes only. LOCKIN does not accept wagers or guarantee outcomes. If you or someone you know has a gambling problem, call 1-800-GAMBLER.",
};

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
  return {
    id: String(row.id),
    text: String(row.text ?? ""),
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
    noEdgeMessage: String(row.no_edge_message ?? DEFAULT_SITE_COPY_CONTENT.noEdgeMessage),
    headerRightText: String(row.header_right_text ?? DEFAULT_SITE_COPY_CONTENT.headerRightText),
    footerDisclaimer: String(row.footer_disclaimer ?? DEFAULT_SITE_COPY_CONTENT.footerDisclaimer),
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

export async function getSocialProofBanner(): Promise<SocialProofBanner | null> {
  const result = await query(`SELECT * FROM social_proof_banner WHERE id = 'default' LIMIT 1`);
  if (!result.rows[0]) {
    return null;
  }

  const banner = mapSocialProofBanner(result.rows[0] as Record<string, RowValue>);
  if (!banner.isActive || !banner.text.trim()) {
    return null;
  }

  return banner;
}

export async function setSocialProofBanner(text: string): Promise<SocialProofBanner> {
  const result = await query(
    `INSERT INTO social_proof_banner (id, text, is_active, updated_at)
     VALUES ('default', $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE
       SET text = EXCLUDED.text,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
     RETURNING *`,
    [text, text.trim().length > 0],
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
  noEdgeMessage?: string;
  headerRightText?: string;
  footerDisclaimer?: string;
}): Promise<SiteCopy> {
  const current = await getSiteCopy();
  const next = {
    dailyCtaText: input.dailyCtaText?.trim() || DEFAULT_SITE_COPY_CONTENT.dailyCtaText,
    noEdgeMessage: input.noEdgeMessage?.trim() || DEFAULT_SITE_COPY_CONTENT.noEdgeMessage,
    headerRightText: input.headerRightText?.trim() || "",
    footerDisclaimer: input.footerDisclaimer?.trim() || DEFAULT_SITE_COPY_CONTENT.footerDisclaimer,
  };

  const result = await query(
    `INSERT INTO site_copy (
       id,
       daily_cta_text,
       no_edge_message,
       header_right_text,
       footer_disclaimer,
       updated_at
     ) VALUES ('default', $1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE
       SET daily_cta_text = EXCLUDED.daily_cta_text,
           no_edge_message = EXCLUDED.no_edge_message,
           header_right_text = EXCLUDED.header_right_text,
           footer_disclaimer = EXCLUDED.footer_disclaimer,
           updated_at = NOW()
     RETURNING *`,
    [
      next.dailyCtaText || current.dailyCtaText,
      next.noEdgeMessage || current.noEdgeMessage,
      next.headerRightText,
      next.footerDisclaimer || current.footerDisclaimer,
    ],
  );

  return mapSiteCopy(result.rows[0] as Record<string, RowValue>);
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

export async function createChatSession(gameId: string): Promise<ChatSession> {
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
     ) VALUES ($1, $2, $3, NULL, 0, 0, FALSE, NOW(), NOW())
     RETURNING *`,
    [crypto.randomUUID(), gameId, crypto.randomUUID()],
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
             questions_used = 0,
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
