import { NextRequest, NextResponse } from "next/server";
import { generateMatchResponse } from "@/lib/llm";
import {
  addChatMessage,
  getChatMessages,
  getChatSession,
  hasChatCapacity,
  touchSession,
  getGames,
  getActiveSystemPrompt,
  getMatchMarkdown,
} from "@/lib/store";
import { syncTodayGames } from "@/lib/daily-edge";
import { getEstDateKey } from "@/lib/time";
import { parseBearerToken, verifyAccessToken } from "@/lib/token";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`chat:${ip}`, 20, 60_000)) {
    return NextResponse.json({ message: "Too many requests. Please slow down." }, { status: 429 });
  }

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

  const session = await getChatSession(sessionId);
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

  if (!(await hasChatCapacity(sessionId))) {
    return NextResponse.json(
      {
        message: "Question limit reached",
        requiresPayment: false,
        questionsRemaining: 0,
      },
      { status: 402 },
    );
  }

  const dateKey = getEstDateKey();
  const liveGames = await syncTodayGames(dateKey);
  const storedGames = await getGames(dateKey);
  const game = liveGames.find((item) => item.id === session.gameId) || storedGames.find((item) => item.id === session.gameId);
  if (!game) {
    return NextResponse.json({ message: "Game context could not be loaded" }, { status: 404 });
  }

  const matchMarkdown = await getMatchMarkdown(session.gameId, dateKey);

  await addChatMessage(sessionId, "user", question);
  session.questionsUsed += 1;
  await touchSession(sessionId, {
    questionsUsed: session.questionsUsed,
    isPaid: session.isPaid,
    email: claimedEmail || session.email,
  });

  const answer = await generateMatchResponse({
    question,
    game,
    matchMarkdown: matchMarkdown?.markdownContent || "",
    unlockedPrediction: Boolean(session.isPaid),
    systemPrompt: (await getActiveSystemPrompt()).content,
  });
  const assistantMessage = await addChatMessage(sessionId, "assistant", answer);

  return NextResponse.json({
    assistantMessage,
    messages: await getChatMessages(sessionId),
    questionsRemaining: Math.max(0, session.questionLimit - session.questionsUsed),
    isLocked: !(await hasChatCapacity(sessionId)),
  });
}
