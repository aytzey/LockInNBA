import { NextRequest, NextResponse } from "next/server";
import { createChatSession, remainingQuestions, getChatMessages, getMatchMarkdown } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const gameId = body?.gameId as string | undefined;
  const email = (body?.email || "").toString().trim().toLowerCase();

  if (!gameId) {
    return NextResponse.json({ message: "gameId is required" }, { status: 400 });
  }

  const session = await createChatSession(gameId, email || undefined);
  const hasMatchMarkdown = Boolean(await getMatchMarkdown(session.gameId, getEstDateKey()));
  return NextResponse.json({
    session,
    questionsRemaining: await remainingQuestions(session.id),
    messages: await getChatMessages(session.id),
    hasMatchMarkdown,
  });
}

export async function GET() {
  return NextResponse.json({});
}
