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
  const seed = Math.abs(hashCode(prompt)) % 6;
  const responses = [
    `## Matchup Analysis

Looking at the available data for this game:

- **Pace differential** is the key factor here. The road team ranks above league average in transition efficiency over their last 10 games.
- **Defensive matchup**: The home team's perimeter defense has been inconsistent, allowing 37%+ from three in 4 of their last 6 games.
- **Key angle**: Watch the rebounding margin — second-chance points could swing this game.

**Bottom line**: There's a slight lean based on tempo mismatch, but this is a one-unit-max situation. Never chase.`,

    `## Statistical Breakdown

Here's what the numbers tell us:

- **Offensive rating**: Both teams are within 2 points of each other over the last 7 games, making this a close call.
- **Rest advantage**: Neither team has a significant rest edge tonight.
- **Home court factor**: The home team is covering at a 58% clip at home this season, which is above league average.

**My take**: The home side has the slight statistical edge, but the margin is thin. If you're playing this, keep it disciplined — standard unit size only.`,

    `## Edge Assessment

Breaking down this matchup by the numbers:

- **Turnover differential** favors the away team — they force 2.3 more turnovers per game than the league average.
- **Free throw rate**: The home team gets to the line frequently, which could neutralize the turnover edge.
- **Fourth quarter performance**: The away team has a +3.2 net rating in 4th quarters over their last 8 games.

**Conclusion**: There's a marginal edge on the away side if you trust their ability to close. Use proper bankroll management and don't oversize this play.`,

    `## Game Context Review

Let me walk through the key factors:

- **Back-to-back situation**: Check if either team is on the second night of a back-to-back, as this significantly impacts late-game performance.
- **Injury report**: Always verify the latest injury updates before committing to any position.
- **Line movement**: If the line has moved significantly since open, that suggests sharp money has already acted.

**Summary**: The raw matchup data shows a competitive game. Focus on the factors above before making any decisions. Protect your bankroll — this looks like a pass or small-unit play.`,

    `## Detailed Matchup Review

Key data points for tonight:

- **Three-point shooting**: The away team shoots 36.8% from deep, while the home defense allows 35.1%. Not a massive gap, but worth noting.
- **Paint scoring**: The home team dominates in the paint with +4.2 points per game advantage, suggesting their interior presence is a factor.
- **Clutch performance**: In games decided by 5 or fewer points, the home team has a 7-3 record this season.

**Assessment**: The home team has a structural advantage in the paint, but the away team's shooting keeps them competitive. This is a coin-flip game — be disciplined with your bankroll.`,

    `## Quick Analysis

Here's my read on this matchup:

- **ATS trend**: The underdog has covered in 4 of the last 5 meetings between these teams.
- **Total trend**: The over has hit in 3 of the last 5 for the home team, suggesting pace plays a role.
- **Motivation factor**: Check playoff standings — teams fighting for seeding tend to play with more intensity in Q4.

**Verdict**: Historical trends favor the underdog here, but trends are just one piece of the puzzle. Combine this with your own research and never bet more than you can afford to lose.`,
  ];

  return responses[seed];
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}
