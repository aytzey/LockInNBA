import { NextRequest, NextResponse } from "next/server";
import { createChatSession, remainingQuestions, getChatMessages } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const gameId = body?.gameId as string | undefined;

  if (!gameId) {
    return NextResponse.json({ message: "gameId is required" }, { status: 400 });
  }

  const session = createChatSession(gameId);
  return NextResponse.json({
    session,
    questionsRemaining: remainingQuestions(session.id),
    messages: getChatMessages(session.id),
  });
}

export async function GET() {
  return NextResponse.json({});
}
