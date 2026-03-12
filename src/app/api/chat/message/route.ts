import { NextRequest, NextResponse } from "next/server";
import { buildModelPrompt, mockAiResponse } from "@/lib/llm";
import {
  addChatMessage,
  getChatMessages,
  getChatSession,
  hasChatCapacity,
  touchSession,
  getGames,
  getTodayPrediction,
} from "@/lib/store";
import { getEstDateKey } from "@/lib/time";
import { parseBearerToken, verifyAccessToken } from "@/lib/token";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const sessionId = (body?.sessionId || "") as string;
  const question = (body?.message || "").toString().trim();
  const claimedEmail = (body?.email || "").toLowerCase().trim();

  if (!sessionId) {
    return NextResponse.json({ message: "sessionId is required" }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ message: "message is required" }, { status: 400 });
  }

  const session = getChatSession(sessionId);
  if (!session) {
    return NextResponse.json({ message: "Session not found" }, { status: 404 });
  }

  const tokenHeader = parseBearerToken(request.headers.get("authorization"));
  const tokenPayload = verifyAccessToken(tokenHeader);
  const hasToken = Boolean(tokenPayload && tokenPayload.type === "chat" && tokenPayload.sessionId === sessionId);

  if (!session.isPaid || !hasToken) {
    return NextResponse.json(
      {
        message: "Payment required to chat",
        requiresPayment: true,
        questionsRemaining: 0,
      },
      { status: 402 },
    );
  }

  if (!hasChatCapacity(sessionId)) {
    return NextResponse.json(
      {
        message: "Question limit reached",
        requiresPayment: false,
        questionsRemaining: 0,
      },
      { status: 402 },
    );
  }

  const game = getGames(getEstDateKey()).find((item) => item.id === session.gameId);
  const prediction = getTodayPrediction(getEstDateKey());
  const context = buildModelPrompt({
    question,
    game: game || {
      id: session.gameId,
      date: getEstDateKey(),
      awayTeam: "",
      homeTeam: "",
      gameTimeEST: new Date().toISOString(),
      status: "upcoming",
      awayScore: null,
      homeScore: null,
      awayMoneyline: 0,
      homeMoneyline: 0,
      oddsSource: "DraftKings",
      apiGameId: "",
    },
    odds: `${game?.awayMoneyline ?? 0} / ${game?.homeMoneyline ?? 0}`,
    predictionText: prediction.markdownContent,
    unlockedPrediction: Boolean(session.isPaid),
  });

  addChatMessage(sessionId, "user", question);
  session.questionsUsed += 1;
  touchSession(sessionId, {
    questionsUsed: session.questionsUsed,
    isPaid: session.isPaid,
    email: claimedEmail || session.email,
  });

  const answer = mockAiResponse(context);
  const assistantMessage = addChatMessage(sessionId, "assistant", answer);

  return NextResponse.json({
    assistantMessage,
    messages: getChatMessages(sessionId),
    questionsRemaining: Math.max(0, session.questionLimit - session.questionsUsed),
    isLocked: !hasChatCapacity(sessionId),
  });
}
