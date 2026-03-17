import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { getOptionalEnv } from "./env";

const DEFAULT_SYSTEM_PROMPT =
  "Sen LOCKIN'ın NBA analiz asistanısın. Veri odaklı ve net konuş. Sadece istatistiksel avantajları göster, kesin sonuç vaadi verme, bahis tavsiyesi olarak yorumlanmaması için dikkatli ol.";
const SCHEMA_VERSION = 2026031702;

declare global {
  var __lockinDbPool: Pool | undefined;
  var __lockinDbSchemaPromise: Promise<void> | undefined;
}

function getDatabaseUrl(): string {
  const url = getOptionalEnv("DATABASE_URL") || getOptionalEnv("SUPABASE_DB_URL");
  if (!url) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  return url;
}

function createPool(): Pool {
  const connectionString = getDatabaseUrl();
  const shouldUseSsl =
    connectionString.includes("sslmode=require") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("supabase.com");

  return new Pool({
    connectionString,
    max: 3,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  });
}

function getPool(): Pool {
  if (!globalThis.__lockinDbPool) {
    globalThis.__lockinDbPool = createPool();
  }

  return globalThis.__lockinDbPool;
}

async function runSchemaSetup(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lockin_schema_state (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS predictions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      teaser_text TEXT NOT NULL,
      markdown_content TEXT NOT NULL,
      is_no_edge_day BOOLEAN NOT NULL DEFAULT FALSE,
      source TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT predictions_source_check CHECK (source IN ('auto', 'admin'))
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_predictions_date ON predictions (date DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_proof_banner (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL DEFAULT '',
      messages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE social_proof_banner ADD COLUMN IF NOT EXISTS messages_json JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`
    UPDATE social_proof_banner
    SET messages_json = CASE
      WHEN jsonb_array_length(messages_json) > 0 THEN messages_json
      WHEN btrim(text) <> '' THEN jsonb_build_array(text)
      ELSE '[]'::jsonb
    END
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_copy (
      id TEXT PRIMARY KEY,
      daily_cta_text TEXT NOT NULL DEFAULT 'Unlock Tonight''s Edge',
      daily_price_subtext TEXT NOT NULL DEFAULT '$5 one-time pass',
      no_edge_message TEXT NOT NULL DEFAULT 'We passed on 90% of this week''s games. We only bet when the math screams.',
      header_right_text TEXT NOT NULL DEFAULT '',
      meta_description TEXT NOT NULL DEFAULT 'LOCKIN is a premium AI sports analytics platform delivering nightly NBA moneyline analysis and per-game statistical insights.',
      footer_disclaimer TEXT NOT NULL DEFAULT 'For entertainment purposes only. LOCKIN does not accept wagers or guarantee outcomes. If you or someone you know has a gambling problem, call 1-800-GAMBLER.',
      track_record_markdown TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE site_copy ADD COLUMN IF NOT EXISTS daily_price_subtext TEXT NOT NULL DEFAULT '$5 one-time pass'`);
  await pool.query(`ALTER TABLE site_copy ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT 'LOCKIN is a premium AI sports analytics platform delivering nightly NBA moneyline analysis and per-game statistical insights.'`);
  await pool.query(`ALTER TABLE site_copy ADD COLUMN IF NOT EXISTS track_record_markdown TEXT NOT NULL DEFAULT ''`);
  await pool.query(`
    UPDATE site_copy
    SET daily_cta_text = 'Unlock Tonight''s Edge'
    WHERE daily_cta_text = 'Unlock Tonight''s Edge — $5'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_banner (
      id TEXT PRIMARY KEY,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      banner_text TEXT NOT NULL DEFAULT '',
      end_datetime TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_markdowns (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      date TEXT NOT NULL,
      markdown_content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_match_markdowns_game_date ON match_markdowns (game_id, date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_match_markdowns_date ON match_markdowns (date)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_picks (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      game_id TEXT NOT NULL,
      picked_side TEXT NOT NULL,
      analysis_markdown TEXT NOT NULL DEFAULT '',
      result TEXT NOT NULL DEFAULT 'pending',
      profit_units NUMERIC(10, 2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT daily_picks_side_check CHECK (picked_side IN ('away', 'home')),
      CONSTRAINT daily_picks_result_check CHECK (result IN ('pending', 'win', 'loss'))
    )
  `);

  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_picks_date_game ON daily_picks (date, game_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_daily_picks_date ON daily_picks (date DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_prompts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_system_prompts_version ON system_prompts (version)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      away_team TEXT NOT NULL,
      away_display_name TEXT NOT NULL,
      away_record TEXT NOT NULL,
      away_leader TEXT NOT NULL,
      away_logo TEXT NOT NULL,
      home_team TEXT NOT NULL,
      home_display_name TEXT NOT NULL,
      home_record TEXT NOT NULL,
      home_leader TEXT NOT NULL,
      home_logo TEXT NOT NULL,
      game_time_est TEXT NOT NULL,
      status TEXT NOT NULL,
      status_detail TEXT NOT NULL,
      away_score INTEGER,
      home_score INTEGER,
      away_moneyline INTEGER NOT NULL,
      home_moneyline INTEGER NOT NULL,
      odds_source TEXT NOT NULL,
      spread TEXT NOT NULL,
      total TEXT NOT NULL,
      broadcast TEXT NOT NULL,
      venue TEXT NOT NULL,
      game_url TEXT NOT NULL,
      api_game_id TEXT NOT NULL
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_games_date ON games (date)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS data_refresh_state (
      key TEXT PRIMARY KEY,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      email TEXT,
      question_limit INTEGER NOT NULL DEFAULT 0,
      questions_used INTEGER NOT NULL DEFAULT 0,
      is_paid BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_sessions_game_id ON chat_sessions (game_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_sessions_email_game_created ON chat_sessions (LOWER(email), game_id, created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      chat_session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant'))
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
    ON chat_messages (chat_session_id, created_at)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkout_sessions (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      game_id TEXT,
      chat_session_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT checkout_sessions_type_check CHECK (type IN ('daily_pick', 'match_chat', 'extra_questions')),
      CONSTRAINT checkout_sessions_status_check CHECK (status IN ('pending', 'paid'))
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      stripe_payment_id TEXT NOT NULL UNIQUE,
      stripe_customer_email TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      game_id TEXT,
      chat_session_id TEXT,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT payments_type_check CHECK (type IN ('daily_pick', 'match_chat', 'extra_questions')),
      CONSTRAINT payments_status_check CHECK (status IN ('pending', 'paid', 'failed'))
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_email ON payments (LOWER(stripe_customer_email))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_chat_session_id ON payments (chat_session_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS magic_links (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      is_used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links (LOWER(email))`);

  await pool.query(
    `INSERT INTO system_prompts (id, content, version, is_active, created_at)
     SELECT 'default-system-prompt', $1, 1, TRUE, NOW()
     WHERE NOT EXISTS (SELECT 1 FROM system_prompts)`,
    [DEFAULT_SYSTEM_PROMPT],
  );

  const appTables = [
    "lockin_schema_state",
    "predictions",
    "social_proof_banner",
    "site_copy",
    "promo_banner",
    "system_prompts",
    "games",
    "match_markdowns",
    "daily_picks",
    "chat_sessions",
    "chat_messages",
    "checkout_sessions",
    "payments",
    "magic_links",
    "data_refresh_state",
  ];

  for (const table of appTables) {
    await pool.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await pool.query(`REVOKE ALL ON TABLE "${table}" FROM anon, authenticated`);
  }

  // New tables created by this bootstrap should stay closed to the public Data API
  // unless we explicitly grant access later.
  await pool.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`,
  );

  await pool.query(
    `INSERT INTO lockin_schema_state (id, version, updated_at)
     VALUES ('default', $1, NOW())
     ON CONFLICT (id) DO UPDATE
       SET version = EXCLUDED.version,
           updated_at = NOW()`,
    [SCHEMA_VERSION],
  );
}

async function getAppliedSchemaVersion(): Promise<number | null> {
  const pool = getPool();

  try {
    const result = await pool.query<{ version: number }>(
      `SELECT version FROM lockin_schema_state WHERE id = 'default' LIMIT 1`,
    );
    if (!result.rows[0]) {
      return 0;
    }

    const version = Number(result.rows[0].version);
    return Number.isFinite(version) ? version : 0;
  } catch {
    return null;
  }
}

async function ensureSchema(): Promise<void> {
  if (!globalThis.__lockinDbSchemaPromise) {
    globalThis.__lockinDbSchemaPromise = (async () => {
      const appliedVersion = await getAppliedSchemaVersion();
      if (appliedVersion !== null && appliedVersion >= SCHEMA_VERSION) {
        return;
      }

      await runSchemaSetup();
    })().catch((error) => {
      globalThis.__lockinDbSchemaPromise = undefined;
      throw error;
    });
  }

  await globalThis.__lockinDbSchemaPromise;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  await ensureSchema();
  const pool = getPool();
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
