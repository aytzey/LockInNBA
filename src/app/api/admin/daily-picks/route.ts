import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin";
import { syncTodayGames } from "@/lib/daily-edge";
import {
  buildAutomaticTrackRecordMarkdown,
  getPublicDailyEdgePreview,
  listDailyPicksWithGamesForDate,
  listDailySlateSummaries,
  saveDailyPickSlate,
} from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

function isAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return Boolean(token && verifyAdminToken(token));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date") || getEstDateKey();
  const [games, picks, preview, slates, trackRecordMarkdown] = await Promise.all([
    syncTodayGames(date),
    listDailyPicksWithGamesForDate(date),
    getPublicDailyEdgePreview(date),
    listDailySlateSummaries(),
    buildAutomaticTrackRecordMarkdown(),
  ]);

  return NextResponse.json({
    date,
    games,
    picks,
    preview,
    slates,
    trackRecordMarkdown,
  });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const date = (body?.date || "").toString().trim() || getEstDateKey();
  const isNoEdgeDay = Boolean(body?.isNoEdgeDay);
  const picks = Array.isArray(body?.picks)
    ? body.picks.map((pick: {
        gameId?: unknown;
        pickedSide?: unknown;
        analysisMarkdown?: unknown;
        result?: unknown;
        profitUnits?: unknown;
      }) => ({
        gameId: (pick?.gameId || "").toString().trim(),
        pickedSide: pick?.pickedSide === "home" ? "home" : "away",
        analysisMarkdown: (pick?.analysisMarkdown || "").toString(),
        result:
          pick?.result === "win" || pick?.result === "loss"
            ? pick.result
            : "pending",
        profitUnits:
          typeof pick?.profitUnits === "number"
            ? pick.profitUnits
            : Number.isFinite(Number(pick?.profitUnits))
              ? Number(pick?.profitUnits)
              : null,
      }))
    : [];

  const saved = await saveDailyPickSlate(date, {
    isNoEdgeDay,
    picks,
  });
  const [slates, trackRecordMarkdown] = await Promise.all([
    listDailySlateSummaries(),
    buildAutomaticTrackRecordMarkdown(),
  ]);

  return NextResponse.json({
    date,
    preview: saved.preview,
    picks: saved.picks,
    slates,
    trackRecordMarkdown,
  });
}
