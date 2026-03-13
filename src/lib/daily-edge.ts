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
const FINAL_GAMES_REFRESH_MS = 15 * 60 * 1000;
const EMPTY_SLATE_REFRESH_MS = 30 * 60 * 1000;
const LIVE_TRACKING_LEAD_MS = 5 * 60 * 1000;

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

export interface PublicGamesResult {
  games: Game[];
  updatedAt: string | null;
  refreshed: boolean;
  source: "cache" | "live";
  cacheControl: "fixture" | "volatile";
  cacheSnapshot?: Game[];
}

export function predictionHasContent(prediction: DailyPrediction): boolean {
  return prediction.teaserText.trim().length > 0 && (prediction.markdownContent.trim().length > 0 || prediction.isNoEdgeDay);
}

export function predictionNeedsRefresh(prediction: DailyPrediction, forcePrediction: boolean): boolean {
  if (forcePrediction) {
    return prediction.source !== "admin";
  }

  if (!predictionHasContent(prediction)) {
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

async function loadGamesState(date: string): Promise<{
  cachedGames: Game[];
  lastUpdatedAt: string | null;
}> {
  const [cachedGames, refreshState] = await Promise.all([
    getGames(date),
    getGamesRefreshState(date),
  ]);

  return {
    cachedGames,
    lastUpdatedAt: refreshState?.updatedAt ?? null,
  };
}

function getGamesRefreshWindowMs(date: string, games: Game[]): number {
  if (games.length === 0) {
    return EMPTY_SLATE_REFRESH_MS;
  }

  if (shouldTrackStartedGames(date, games)) {
    return LIVE_GAMES_REFRESH_MS;
  }

  return FINAL_GAMES_REFRESH_MS;
}

function shouldTrackStartedGames(date: string, games: Game[]): boolean {
  if (date !== getEstDateKey()) {
    return games.some((game) => game.status === "live");
  }

  const now = Date.now();

  return games.some((game) => {
    if (game.status === "live") {
      return true;
    }

    if (game.status === "final") {
      return false;
    }

    const tipoffAt = new Date(game.gameTimeEST).getTime();
    if (Number.isNaN(tipoffAt)) {
      return false;
    }

    return now >= (tipoffAt - LIVE_TRACKING_LEAD_MS);
  });
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

  if (games.length > 0 && date === getEstDateKey() && !shouldTrackStartedGames(date, games)) {
    // Once today's slate is cached, keep using the DB schedule until tipoff.
    return false;
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
  const { cachedGames, lastUpdatedAt } = await loadGamesState(date);

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
      const games = await fetchTodayGames(date, forceRefresh ? { bypassCache: true } : undefined);
      if (games.length === 0) {
        return {
          games: cachedGames,
          updatedAt: lastUpdatedAt,
          refreshed: false,
        };
      }

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

export async function getPublicGames(date = getEstDateKey()): Promise<PublicGamesResult> {
  const today = getEstDateKey();
  const { cachedGames, lastUpdatedAt } = await loadGamesState(date);

  if (date !== today) {
    const result = await getFreshGames(date);
    return {
      ...result,
      source: "cache",
      cacheControl: "volatile",
    };
  }

  if (cachedGames.length === 0) {
    const result = await getFreshGames(date);
    const retryResult = result.games.length === 0 ? await getFreshGames(date, true) : result;
    return {
      ...retryResult,
      source: "cache",
      cacheControl: shouldTrackStartedGames(date, retryResult.games) ? "volatile" : "fixture",
    };
  }

  const shouldUseLiveWindow = shouldTrackStartedGames(date, cachedGames);

  if (shouldUseLiveWindow) {
    try {
      const liveSnapshot = await fetchTodayGames(date, { bypassCache: true });
      const mergedGames = mergeLatestGames(cachedGames, liveSnapshot);
      const shouldPersistSnapshot =
        !lastUpdatedAt ||
        Number.isNaN(new Date(lastUpdatedAt).getTime()) ||
        (Date.now() - new Date(lastUpdatedAt).getTime()) >= LIVE_GAMES_REFRESH_MS;

      return {
        games: mergedGames,
        updatedAt: new Date().toISOString(),
        refreshed: true,
        source: "live",
        cacheControl: "volatile",
        cacheSnapshot: shouldPersistSnapshot ? mergedGames : undefined,
      };
    } catch {
      // Fall back to cached/stale refresh path when the direct live pull fails.
    }
  }

  return {
    games: cachedGames,
    updatedAt: lastUpdatedAt,
    refreshed: false,
    source: "cache",
    cacheControl: shouldUseLiveWindow ? "volatile" : "fixture",
  };
}

export async function syncTodayGames(date = getEstDateKey(), forceRefresh = false): Promise<Game[]> {
  const result = await getFreshGames(date, forceRefresh);
  return result.games;
}

export async function persistGamesSnapshot(date: string, games: Game[]): Promise<void> {
  await setGames(date, games);
  await touchGamesRefreshState(date);
}

export async function refreshPredictionForDate(date = getEstDateKey(), forcePrediction = false): Promise<{
  prediction: DailyPrediction;
  refreshed: boolean;
  games: Game[];
}> {
  const { games } = await getFreshGames(date);
  const existing = await getTodayPrediction(date);

  if (!predictionNeedsRefresh(existing, forcePrediction)) {
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

  if (predictionHasContent(existing)) {
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
