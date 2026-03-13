import { getOptionalEnv } from "./env";
import { generateDailyPrediction } from "./llm";
import { fetchTodayGames, mergeLatestGames } from "./nba";
import {
  getActiveSystemPrompt,
  getGames,
  getGamesRefreshState,
  getTodayPrediction,
  savePrediction,
  setGames,
  touchGamesRefreshState,
} from "./store";
import { getEstDateKey } from "./time";
import { DailyPrediction, Game } from "./types";

const AUTO_PREDICTION_REFRESH_MS = Math.max(
  60,
  Number.parseInt(getOptionalEnv("LOCKIN_AUTO_PREDICTION_REFRESH_SECONDS") || "1800", 10) || 1800,
) * 1000;
const LIVE_GAMES_REFRESH_MS = 60 * 1000;
const UPCOMING_GAMES_REFRESH_MS = 90 * 1000;
const FINAL_GAMES_REFRESH_MS = 15 * 60 * 1000;
const EMPTY_SLATE_REFRESH_MS = 30 * 60 * 1000;

declare global {
  var __lockinGamesRefreshJobs: Map<string, Promise<{
    games: Game[];
    updatedAt: string | null;
    refreshed: boolean;
  }>> | undefined;
}

function getGamesRefreshJobs() {
  if (!globalThis.__lockinGamesRefreshJobs) {
    globalThis.__lockinGamesRefreshJobs = new Map();
  }

  return globalThis.__lockinGamesRefreshJobs;
}

function hasPredictionContent(prediction: DailyPrediction): boolean {
  return prediction.teaserText.trim().length > 0 && (prediction.markdownContent.trim().length > 0 || prediction.isNoEdgeDay);
}

function shouldRefreshPrediction(prediction: DailyPrediction, forcePrediction: boolean): boolean {
  if (forcePrediction) {
    return prediction.source !== "admin";
  }

  if (!hasPredictionContent(prediction)) {
    return true;
  }

  if (prediction.source === "admin") {
    return false;
  }

  const updatedAt = new Date(prediction.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) {
    return true;
  }

  return (Date.now() - updatedAt) >= AUTO_PREDICTION_REFRESH_MS;
}

function getGamesRefreshWindowMs(date: string, games: Game[]): number {
  if (games.length === 0) {
    return EMPTY_SLATE_REFRESH_MS;
  }

  if (games.some((game) => game.status === "live")) {
    return LIVE_GAMES_REFRESH_MS;
  }

  if (games.some((game) => game.status === "upcoming")) {
    return date === getEstDateKey() ? UPCOMING_GAMES_REFRESH_MS : EMPTY_SLATE_REFRESH_MS;
  }

  return FINAL_GAMES_REFRESH_MS;
}

function shouldRefreshGames(
  date: string,
  games: Game[],
  lastUpdatedAt: string | null,
  forceRefresh: boolean,
): boolean {
  if (forceRefresh) {
    return true;
  }

  if (!lastUpdatedAt) {
    return true;
  }

  const updatedAt = new Date(lastUpdatedAt).getTime();
  if (Number.isNaN(updatedAt)) {
    return true;
  }

  return (Date.now() - updatedAt) >= getGamesRefreshWindowMs(date, games);
}

export async function getFreshGames(date = getEstDateKey(), forceRefresh = false): Promise<{
  games: Game[];
  updatedAt: string | null;
  refreshed: boolean;
}> {
  const cachedGames = await getGames(date);
  const refreshState = await getGamesRefreshState(date);
  const lastUpdatedAt = refreshState?.updatedAt ?? null;

  if (!shouldRefreshGames(date, cachedGames, lastUpdatedAt, forceRefresh)) {
    return {
      games: cachedGames,
      updatedAt: lastUpdatedAt,
      refreshed: false,
    };
  }

  const cacheKey = `${date}:${forceRefresh ? "force" : "stale"}`;
  const jobs = getGamesRefreshJobs();
  const inFlight = jobs.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const job = (async () => {
    try {
      const games = await fetchTodayGames(date);
      await setGames(date, games);
      const nextState = await touchGamesRefreshState(date);
      return {
        games,
        updatedAt: nextState.updatedAt,
        refreshed: true,
      };
    } catch {
      return {
        games: cachedGames,
        updatedAt: lastUpdatedAt,
        refreshed: false,
      };
    } finally {
      jobs.delete(cacheKey);
    }
  })();

  jobs.set(cacheKey, job);
  return job;
}

export async function getPublicGames(date = getEstDateKey()): Promise<{
  games: Game[];
  updatedAt: string | null;
  refreshed: boolean;
  source: "cache" | "live";
}> {
  const today = getEstDateKey();
  const cachedGames = await getGames(date);
  const refreshState = await getGamesRefreshState(date);
  const lastUpdatedAt = refreshState?.updatedAt ?? null;

  if (date !== today) {
    const result = await getFreshGames(date);
    return {
      ...result,
      source: "cache",
    };
  }

  if (cachedGames.some((game) => game.status === "live")) {
    try {
      const liveSnapshot = await fetchTodayGames(date, { bypassCache: true });
      return {
        games: mergeLatestGames(cachedGames, liveSnapshot),
        updatedAt: new Date().toISOString(),
        refreshed: true,
        source: "live",
      };
    } catch {
      // Fall back to cached/stale refresh path when the direct live pull fails.
    }
  }

  if (!shouldRefreshGames(date, cachedGames, lastUpdatedAt, false)) {
    return {
      games: cachedGames,
      updatedAt: lastUpdatedAt,
      refreshed: false,
      source: "cache",
    };
  }

  const result = await getFreshGames(date);
  return {
    ...result,
    source: "cache",
  };
}

export async function syncTodayGames(date = getEstDateKey(), forceRefresh = false): Promise<Game[]> {
  const result = await getFreshGames(date, forceRefresh);
  return result.games;
}

export async function refreshPredictionForDate(date = getEstDateKey(), forcePrediction = false): Promise<{
  prediction: DailyPrediction;
  refreshed: boolean;
  games: Game[];
}> {
  const { games } = await getFreshGames(date);
  const existing = await getTodayPrediction(date);

  if (!shouldRefreshPrediction(existing, forcePrediction)) {
    return {
      prediction: existing,
      refreshed: false,
      games,
    };
  }

  const generated = await generateDailyPrediction({
    games,
    systemPrompt: (await getActiveSystemPrompt()).content,
  });

  const prediction = await savePrediction({
    date,
    teaserText: generated.teaserText,
    markdownContent: generated.markdownContent,
    isNoEdgeDay: generated.isNoEdgeDay,
    source: "auto",
  });

  return {
    prediction,
    refreshed: true,
    games,
  };
}

export async function getOrCreateTodayPrediction(date = getEstDateKey()): Promise<DailyPrediction> {
  const result = await refreshPredictionForDate(date);
  return result.prediction;
}

export async function getPublicPredictionPreview(date = getEstDateKey()): Promise<DailyPrediction> {
  const existing = await getTodayPrediction(date);

  if (hasPredictionContent(existing)) {
    if (shouldRefreshPrediction(existing, false)) {
      void refreshPredictionForDate(date).catch(() => undefined);
    }

    return existing;
  }

  const result = await refreshPredictionForDate(date);
  return result.prediction;
}

export async function refreshLiveData(dates: string[], forcePrediction = false): Promise<Array<{
  date: string;
  gameCount: number;
  predictionRefreshed: boolean;
  predictionSource: DailyPrediction["source"];
  predictionUpdatedAt: string;
  isNoEdgeDay: boolean;
}>> {
  const uniqueDates = [...new Set(dates)];
  const results = [];

  for (const date of uniqueDates) {
    const { games: syncedGames } = await getFreshGames(date, true);
    const { prediction, refreshed } = await refreshPredictionForDate(date, forcePrediction);
    results.push({
      date,
      gameCount: syncedGames.length,
      predictionRefreshed: refreshed,
      predictionSource: prediction.source,
      predictionUpdatedAt: prediction.updatedAt,
      isNoEdgeDay: prediction.isNoEdgeDay,
    });
  }

  return results;
}
