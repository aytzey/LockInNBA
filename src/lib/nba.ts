import { EST_TZ, getEstDateKey } from "./time";
import { Game } from "./types";

interface EspnScoreboardResponse {
  events?: EspnEvent[];
}

interface EspnEvent {
  id: string;
  date: string;
  competitions?: EspnCompetition[];
  links?: Array<{ href?: string; rel?: string[] }>;
  status?: {
    type?: {
      state?: string;
      detail?: string;
      shortDetail?: string;
      completed?: boolean;
    };
  };
}

interface EspnCompetition {
  date: string;
  competitors?: EspnCompetitor[];
  odds?: EspnOdds[];
  broadcasts?: Array<{ names?: string[] }>;
  venue?: { fullName?: string };
  status?: EspnEvent["status"];
}

interface EspnCompetitor {
  homeAway?: "home" | "away";
  score?: string;
  records?: Array<{ name?: string; type?: string; summary?: string }>;
  statistics?: Array<{ name?: string; abbreviation?: string; displayValue?: string }>;
  leaders?: Array<{
    name?: string;
    displayName?: string;
    leaders?: Array<{
      displayValue?: string;
      athlete?: { shortName?: string; displayName?: string; fullName?: string };
    }>;
  }>;
  team?: {
    abbreviation?: string;
    displayName?: string;
    logo?: string;
  };
}

interface EspnOdds {
  provider?: {
    displayName?: string;
    name?: string;
  };
  moneyline?: {
    home?: { close?: { odds?: string }; open?: { odds?: string } };
    away?: { close?: { odds?: string }; open?: { odds?: string } };
  };
  pointSpread?: {
    home?: { close?: { line?: string } };
    away?: { close?: { line?: string } };
  };
  total?: {
    over?: { close?: { line?: string } };
    under?: { close?: { line?: string } };
  };
}

function toScore(value?: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMoneyline(value?: string): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readRecord(competitor?: EspnCompetitor): string {
  return competitor?.records?.find((item) => item.type === "total" || item.name === "overall")?.summary || "Record unavailable";
}

function readLeader(competitor?: EspnCompetitor): string {
  const preferredOrder = ["pointsPerGame", "rating", "reboundsPerGame", "assistsPerGame"];
  const bucket =
    preferredOrder
      .map((key) => competitor?.leaders?.find((item) => item.name === key))
      .find(Boolean) ||
    competitor?.leaders?.find((item) => item.leaders?.length);

  const leader = bucket?.leaders?.[0];
  const athleteName = leader?.athlete?.shortName || leader?.athlete?.displayName || leader?.athlete?.fullName;
  const line = leader?.displayValue;
  if (!athleteName || !line) {
    return "Rotation watch";
  }
  return `${athleteName} ${line}`;
}

function normalizeOddsSource(providerName?: string): Game["oddsSource"] {
  const normalized = providerName?.toLowerCase() || "";
  if (normalized.includes("draft")) return "DraftKings";
  if (normalized.includes("betmgm")) return "BetMGM";
  return "FanDuel";
}

function mapStatus(event: EspnEvent): Game["status"] {
  const state = event.competitions?.[0]?.status?.type?.state || event.status?.type?.state;
  if (state === "in") return "live";
  if (state === "post") return "final";
  return "upcoming";
}

function sortGames(a: Game, b: Game): number {
  const order = { live: 0, upcoming: 1, final: 2 } as const;
  const diff = order[a.status] - order[b.status];
  if (diff !== 0) return diff;
  return new Date(a.gameTimeEST).getTime() - new Date(b.gameTimeEST).getTime();
}

function preferValue<T>(primary: T, fallback: T, isMissing: (value: T) => boolean): T {
  return isMissing(primary) ? fallback : primary;
}

function fallbackTotal(odds?: EspnOdds): string {
  const over = odds?.total?.over?.close?.line;
  const under = odds?.total?.under?.close?.line;
  if (over) return over.replace(/^o/i, "");
  if (under) return under.replace(/^u/i, "");
  return "Market pending";
}

function fallbackSpread(competition: EspnCompetition, odds?: EspnOdds, homeTeam?: string, awayTeam?: string): string {
  const homeLine = odds?.pointSpread?.home?.close?.line;
  const awayLine = odds?.pointSpread?.away?.close?.line;

  if (homeLine && homeTeam) {
    return `${homeTeam} ${homeLine}`;
  }
  if (awayLine && awayTeam) {
    return `${awayTeam} ${awayLine}`;
  }

  const detail = competition.odds?.[0];
  if (detail) {
    return `${homeTeam || "Home"} line available`;
  }

  return "Line pending";
}

function toGame(event: EspnEvent, dateKey: string): Game | null {
  const competition = event.competitions?.[0];
  const home = competition?.competitors?.find((item) => item.homeAway === "home");
  const away = competition?.competitors?.find((item) => item.homeAway === "away");
  if (!competition || !home || !away || !home.team?.abbreviation || !away.team?.abbreviation) {
    return null;
  }

  const odds = competition.odds?.[0];
  const gameUrl = event.links?.find((link) => link.rel?.includes("summary"))?.href || "";
  const broadcasts = competition.broadcasts?.flatMap((item) => item.names || []).filter(Boolean) || [];

  return {
    id: event.id,
    date: dateKey,
    awayTeam: away.team.abbreviation,
    awayDisplayName: away.team.displayName || away.team.abbreviation,
    awayRecord: readRecord(away),
    awayLeader: readLeader(away),
    awayLogo: away.team.logo || "",
    homeTeam: home.team.abbreviation,
    homeDisplayName: home.team.displayName || home.team.abbreviation,
    homeRecord: readRecord(home),
    homeLeader: readLeader(home),
    homeLogo: home.team.logo || "",
    gameTimeEST: competition.date || event.date,
    status: mapStatus(event),
    statusDetail: competition.status?.type?.detail || event.status?.type?.detail || "Status pending",
    awayScore: toScore(away.score),
    homeScore: toScore(home.score),
    awayMoneyline: toMoneyline(odds?.moneyline?.away?.close?.odds || odds?.moneyline?.away?.open?.odds),
    homeMoneyline: toMoneyline(odds?.moneyline?.home?.close?.odds || odds?.moneyline?.home?.open?.odds),
    oddsSource: normalizeOddsSource(odds?.provider?.displayName || odds?.provider?.name),
    spread: fallbackSpread(competition, odds, home.team.abbreviation, away.team.abbreviation),
    total: fallbackTotal(odds),
    broadcast: broadcasts.join(" · ") || "Broadcast pending",
    venue: competition.venue?.fullName || "Arena pending",
    gameUrl,
    apiGameId: event.id,
  };
}

export function buildGameContext(game: Game): string {
  return [
    `${game.awayDisplayName} (${game.awayRecord}) at ${game.homeDisplayName} (${game.homeRecord})`,
    `Tipoff: ${new Date(game.gameTimeEST).toLocaleString("en-US", { timeZone: EST_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} ET`,
    `Moneyline: ${game.awayTeam} ${game.awayMoneyline || "OFF"} / ${game.homeTeam} ${game.homeMoneyline || "OFF"}`,
    `Spread: ${game.spread}`,
    `Total: ${game.total}`,
    `Venue: ${game.venue}`,
    `Broadcast: ${game.broadcast}`,
    `Away focal point: ${game.awayLeader}`,
    `Home focal point: ${game.homeLeader}`,
  ].join("\n");
}

export function buildDailySlateContext(games: Game[]): string {
  return games
    .map((game, index) => {
      return `Game ${index + 1}\n${buildGameContext(game)}`;
    })
    .join("\n\n");
}

export function mergeLatestGames(cachedGames: Game[], latestGames: Game[]): Game[] {
  if (cachedGames.length === 0) {
    return [...latestGames].sort(sortGames);
  }

  const cachedById = new Map(cachedGames.map((game) => [game.id, game]));
  const merged = latestGames.map((game) => {
    const cached = cachedById.get(game.id);
    if (!cached) {
      return game;
    }

    return {
      ...cached,
      ...game,
      awayMoneyline: preferValue(game.awayMoneyline, cached.awayMoneyline, (value) => value === 0),
      homeMoneyline: preferValue(game.homeMoneyline, cached.homeMoneyline, (value) => value === 0),
      spread: preferValue(game.spread, cached.spread, (value) => value === "Line pending"),
      total: preferValue(game.total, cached.total, (value) => value === "Market pending"),
      broadcast: preferValue(game.broadcast, cached.broadcast, (value) => value === "Broadcast pending"),
      venue: preferValue(game.venue, cached.venue, (value) => value === "Arena pending"),
    };
  });

  for (const cached of cachedGames) {
    if (!merged.some((game) => game.id === cached.id)) {
      merged.push(cached);
    }
  }

  return merged.sort(sortGames);
}

export async function fetchTodayGames(
  date = getEstDateKey(),
  options?: { bypassCache?: boolean },
): Promise<Game[]> {
  const espnDate = date.replaceAll("-", "");
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDate}&limit=20`,
    options?.bypassCache
      ? {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      }
      : {
        next: { revalidate: 60 },
        headers: {
          Accept: "application/json",
        },
      },
  );

  if (!response.ok) {
    throw new Error(`ESPN scoreboard request failed with ${response.status}`);
  }

  const payload = await response.json() as EspnScoreboardResponse;
  return (payload.events || [])
    .map((event) => toGame(event, date))
    .filter((game): game is Game => Boolean(game))
    .sort(sortGames);
}

export function buildHeuristicDailyPrediction(games: Game[]): {
  teaserText: string;
  markdownContent: string;
  isNoEdgeDay: boolean;
} {
  if (games.length === 0) {
    return {
      teaserText: "No published slate tonight. LOCKIN is waiting for the next board to post.",
      markdownContent: "# No active board\n\nNo NBA games are listed for tonight, so LOCKIN is holding the daily edge until the next slate is live.",
      isNoEdgeDay: true,
    };
  }

  const sorted = [...games].sort((left, right) => {
    return Math.max(Math.abs(right.homeMoneyline), Math.abs(right.awayMoneyline))
      - Math.max(Math.abs(left.homeMoneyline), Math.abs(left.awayMoneyline));
  });
  const game = sorted[0] || games[0];
  const leaningHome = Math.abs(game.homeMoneyline) >= Math.abs(game.awayMoneyline);
  const leanTeam = leaningHome ? game.homeTeam : game.awayTeam;
  const supportRecord = leaningHome ? game.homeRecord : game.awayRecord;
  const star = leaningHome ? game.homeLeader : game.awayLeader;

  return {
    teaserText: `${leanTeam} carries the cleanest moneyline shape on the board.\nRecord pressure, market respect and primary usage all line up in one lane.`,
    markdownContent: [
      "# LOCKIN Daily Edge",
      "",
      `## ${game.awayTeam} @ ${game.homeTeam}`,
      "",
      `- Lean: **${leanTeam} moneyline**`,
      `- Market snapshot: ${game.awayTeam} ${game.awayMoneyline || "OFF"} / ${game.homeTeam} ${game.homeMoneyline || "OFF"} via ${game.oddsSource}`,
      `- Best supporting note: ${leanTeam} enters at **${supportRecord}** with ${star.toLowerCase()}.`,
      `- Secondary filter: total sits at **${game.total}** with ${game.spread}.`,
      "",
      "## Risk",
      "",
      "- Confirm final injury news and any late movement before staking.",
      "- If the number drifts aggressively away from the open, treat it as a pass instead of forcing action.",
    ].join("\n"),
    isNoEdgeDay: false,
  };
}
