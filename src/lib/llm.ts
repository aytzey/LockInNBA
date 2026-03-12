import { Game } from "./types";

interface BuildPromptInput {
  question: string;
  game: Game;
  odds: string;
  predictionText: string;
  unlockedPrediction: boolean;
}

export function buildModelPrompt({ question, game, odds, predictionText, unlockedPrediction }: BuildPromptInput): string {
  return `Game: ${game.awayTeam} @ ${game.homeTeam}\n`+
    `Time: ${new Date(game.gameTimeEST).toISOString()} (EST)\n` +
    `Odds: Away ML ${oddsFrom(game.awayMoneyline)} | Home ML ${oddsFrom(game.homeMoneyline)}\n` +
    `Message odds: ${odds}\n` +
    `Daily unlocked: ${unlockedPrediction ? "true" : "false"}\n` +
    `System context: ${predictionText || "No unlocked prediction available."}\n` +
    `User question: ${question}`;
}

function oddsFrom(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function mockAiResponse(prompt: string): string {
  const seed = prompt.length % 7;
  const chunks = [
    "I see the matchup data as a tight edge lane.\n",
    "Focus on possession quality and defensive communication.\n",
    "I’d watch the first quarter lineup rotation before sizing any stake.\n",
    "Use money-management: one unit max, no martingale.\n",
    "The model suggests no forced edge play today.\n",
    "Road team values transition points but home rebound mismatch is the key.\n",
  ];
  const body = `${chunks[seed]}\n` +
    "I can break it down by pace, shot profile, and live adjustment.\n" +
    "I can't verify every last line with certainty, so treat as an angle, not a promise.";
  return body;
}
