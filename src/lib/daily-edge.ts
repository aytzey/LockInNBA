import { getOptionalEnv } from "./env";
import { generateDailyPrediction } from "./llm";
import { fetchTodayGames } from "./nba";
import { getActiveSystemPrompt, getGames, getTodayPrediction, savePrediction, setGames } from "./store";
import { getEstDateKey } from "./time";
import { DailyPrediction, Game } from "./types";

const AUTO_PREDICTION_REFRESH_MS = Math.max(
  60,
  Number.parseInt(getOptionalEnv("LOCKIN_AUTO_PREDICTION_REFRESH_SECONDS") || "1800", 10) || 1800,
) * 1000;

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

export async function syncTodayGames(date = getEstDateKey()): Promise<Game[]> {
  try {
    const games = await fetchTodayGames(date);
    await setGames(date, games);
    return games;
  } catch {
    return getGames(date);
  }
}

export async function refreshPredictionForDate(date = getEstDateKey(), forcePrediction = false): Promise<{
  prediction: DailyPrediction;
  refreshed: boolean;
  games: Game[];
}> {
  const games = await syncTodayGames(date);
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
    const { games, prediction, refreshed } = await refreshPredictionForDate(date, forcePrediction);
    results.push({
      date,
      gameCount: games.length,
      predictionRefreshed: refreshed,
      predictionSource: prediction.source,
      predictionUpdatedAt: prediction.updatedAt,
      isNoEdgeDay: prediction.isNoEdgeDay,
    });
  }

  return results;
}
