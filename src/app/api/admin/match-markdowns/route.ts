import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin";
import { syncTodayGames } from "@/lib/daily-edge";
import { listMatchMarkdownsForDate, saveMatchMarkdowns } from "@/lib/store";
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
  const [games, matchMarkdowns] = await Promise.all([
    syncTodayGames(date),
    listMatchMarkdownsForDate(date),
  ]);

  return NextResponse.json({ date, games, matchMarkdowns });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const date = (body?.date || "").toString().trim() || getEstDateKey();
  const entries = Array.isArray(body?.entries)
    ? body.entries
        .map((entry: { gameId?: unknown; markdownContent?: unknown }) => ({
          gameId: (entry?.gameId || "").toString().trim(),
          markdownContent: (entry?.markdownContent || "").toString(),
        }))
        .filter((entry: { gameId: string; markdownContent: string }) => entry.gameId)
    : [];

  const matchMarkdowns = await saveMatchMarkdowns(date, entries);
  return NextResponse.json({ date, matchMarkdowns });
}
