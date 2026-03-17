import { getEnv, getOptionalEnv } from "./env";
import { buildDailySlateContext, buildGameContext, buildHeuristicDailyPrediction } from "./nba";
import { ChatMessage, Game } from "./types";

type ChatRole = "system" | "user" | "assistant";

interface ModelMessage {
  role: ChatRole;
  content: string;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: OpenRouterContent;
    };
  }>;
}

type OpenRouterContent = string | Array<{ type?: string; text?: string }>;

interface MatchResponseInput {
  question: string;
  game: Game;
  matchMarkdown: string;
  chatHistory: ChatMessage[];
  unlockedPrediction: boolean;
  systemPrompt: string;
  isFirstAnswer: boolean;
}

interface DailyPredictionInput {
  games: Game[];
  systemPrompt: string;
}

function getOpenRouterConfig() {
  return {
    apiKey: getEnv("OPENROUTER_API_KEY"),
    baseUrl: getEnv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    model: getEnv("OPENROUTER_MODEL", "google/gemini-3.1-flash-lite-preview"),
    siteUrl: getOptionalEnv("OPENROUTER_SITE_URL") || getOptionalEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
    siteName: getEnv("OPENROUTER_SITE_NAME", "LOCKIN NBA"),
  };
}

function readTextContent(content: OpenRouterContent | undefined): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === "text" || !part.type ? part.text || "" : ""))
      .join("")
      .trim();
  }

  return "";
}

const LLM_FETCH_TIMEOUT_MS = 15_000;

async function callOpenRouter(messages: ModelMessage[], options?: { maxTokens?: number; temperature?: number }): Promise<string> {
  const config = getOpenRouterConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": config.siteUrl,
        "X-Title": config.siteName,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: options?.maxTokens ?? 500,
        temperature: options?.temperature ?? 0.4,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null) as OpenRouterResponse & { error?: { message?: string } } | null;
    if (!response.ok) {
      throw new Error(payload?.error?.message || `OpenRouter request failed with ${response.status}`);
    }

    const text = readTextContent(payload?.choices?.[0]?.message?.content);
    if (!text) {
      throw new Error("OpenRouter returned an empty response");
    }

    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractJsonObject(source: string): Record<string, unknown> | null {
  const fencedMatch = source.match(/```json\s*([\s\S]+?)\s*```/i);
  const candidate = fencedMatch?.[1] || source;

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const objectMatch = candidate.match(/\{[\s\S]+\}/);
    if (!objectMatch) {
      return null;
    }

    try {
      return JSON.parse(objectMatch[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function buildHeuristicMatchResponse(input: MatchResponseInput): string {
  const favoriteIsHome = Math.abs(input.game.homeMoneyline) >= Math.abs(input.game.awayMoneyline);
  const favoriteTeam = favoriteIsHome ? input.game.homeTeam : input.game.awayTeam;
  const favoriteRecord = favoriteIsHome ? input.game.homeRecord : input.game.awayRecord;
  const favoriteLeader = favoriteIsHome ? input.game.homeLeader : input.game.awayLeader;
  const underdogTeam = favoriteIsHome ? input.game.awayTeam : input.game.homeTeam;
  const accessContext = input.unlockedPrediction
    ? "The user already has paid access, so give a direct matchup answer."
    : "Keep the answer grounded and standalone to this matchup.";
  const engineContext = input.matchMarkdown.trim()
    ? "A game-specific engine read is available and should anchor the answer."
    : "No game-specific engine read is available, so stay limited to the live matchup data only.";

  if (!input.isFirstAnswer) {
    return `${favoriteTeam} still carries the cleaner moneyline case here. ${favoriteLeader} is the usage piece that matters most late, but ${underdogTeam} can still flip the script if pace and shot variance swing. Keep an eye on the spread (${input.game.spread}) and total (${input.game.total}) before pressing it.`;
  }

  return [
    "## THE READ",
    "",
    `${favoriteTeam} is still carrying the stronger market respect on the moneyline while sitting at **${favoriteRecord}**. ${favoriteLeader} is the usage marker that matters most if this turns half-court late.`,
    "",
    "## EDGE SIGNAL",
    "",
    `${accessContext} ${engineContext} Based on the current board, the cleaner side is **${favoriteTeam} moneyline**, but only at standard stake sizing.`,
    "",
    "## RISK CHECK",
    "",
    `Spread and total context: ${input.game.spread}, total ${input.game.total}. Re-check injuries and late line movement before acting, especially if the number starts running away from the open.`,
  ].join("\n");
}

export async function generateMatchResponse(input: MatchResponseInput): Promise<string> {
  const hasEngineRead = input.matchMarkdown.trim().length > 0;
  const recentHistory = input.chatHistory
    .slice(-6)
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content.trim()}`)
    .join("\n");
  const systemMessage = [
    input.systemPrompt.trim(),
    "",
    "You are answering inside LOCKIN, a paid NBA matchup analysis product.",
    `You must discuss only this game: ${input.game.awayDisplayName} at ${input.game.homeDisplayName}.`,
    "Use only the provided matchup context and market data.",
    "Do not promise outcomes. Do not invent injuries, trends or odds.",
    "Do not mention or compare any other matchup on the slate.",
    input.isFirstAnswer
      ? "This is the first answer in the room. Respond in tight markdown with the sections `## THE READ`, `## EDGE SIGNAL`, and `## RISK CHECK`."
      : "This is a follow-up question. Do not reuse structured section headings. Answer like a sharp analyst in natural conversation.",
    input.isFirstAnswer
      ? "Keep the answer under 220 words and make the final signal actionable but cautious."
      : "Keep the answer under 140 words, direct, natural, and data-backed.",
    hasEngineRead
      ? "A game-specific engine markdown is attached below. Treat it as the only engine note you can use."
      : "No game-specific engine markdown is available. If relevant, briefly note that the engine has not published a detailed read for this matchup.",
  ].join("\n");

  const userMessage = [
    `User question: ${input.question}`,
    "",
    "Matchup context:",
    buildGameContext(input.game),
    "",
    hasEngineRead
      ? `Game-specific engine markdown:\n${input.matchMarkdown.trim()}`
      : "Game-specific engine markdown: unavailable.",
    "",
    recentHistory ? `Recent chat history:\n${recentHistory}` : "Recent chat history: none.",
    "",
    `Paid daily card active: ${input.unlockedPrediction ? "yes" : "no"}`,
    "Important: answer only from the matchup context above.",
  ].join("\n");

  try {
    return await callOpenRouter(
      [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      { maxTokens: 420, temperature: 0.35 },
    );
  } catch {
    return buildHeuristicMatchResponse(input);
  }
}

export async function generateDailyPrediction(input: DailyPredictionInput): Promise<{
  teaserText: string;
  markdownContent: string;
  isNoEdgeDay: boolean;
}> {
  if (input.games.length === 0) {
    return buildHeuristicDailyPrediction(input.games);
  }

  const systemMessage = [
    input.systemPrompt.trim(),
    "",
    "You are creating LOCKIN's daily NBA moneyline feature card.",
    "Use only the supplied slate context.",
    "Pick one best moneyline lane or declare a no-edge day if the board is weak.",
    "Return valid JSON only with this shape:",
    '{"teaserText":"two short lines separated by a newline","markdownContent":"markdown string","isNoEdgeDay":false}',
    "The markdown must contain a heading, 2-4 bullets, and a short risk section.",
    "Do not wrap the JSON in prose.",
  ].join("\n");

  const userMessage = [
    "Today's NBA slate:",
    buildDailySlateContext(input.games),
  ].join("\n\n");

  try {
    const raw = await callOpenRouter(
      [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      { maxTokens: 700, temperature: 0.45 },
    );

    const parsed = extractJsonObject(raw);
    const teaserText = typeof parsed?.teaserText === "string" ? parsed.teaserText.trim() : "";
    const markdownContent = typeof parsed?.markdownContent === "string" ? parsed.markdownContent.trim() : "";
    const isNoEdgeDay = typeof parsed?.isNoEdgeDay === "boolean" ? parsed.isNoEdgeDay : false;

    if (teaserText && markdownContent) {
      return { teaserText, markdownContent, isNoEdgeDay };
    }
  } catch {
    // fall through to deterministic daily summary
  }

  return buildHeuristicDailyPrediction(input.games);
}
