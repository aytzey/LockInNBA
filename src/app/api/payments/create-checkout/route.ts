import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, getTodayPrediction } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`checkout:${ip}`, 10, 60_000)) {
    return NextResponse.json({ message: "Too many requests. Please slow down." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const email = (body?.email || "").toLowerCase().trim();
  const type = body?.type;
  const gameId = body?.gameId;
  const chatSessionId = body?.chatSessionId;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Valid email required" }, { status: 400 });
  }

  if (type !== "daily_pick" && type !== "match_chat" && type !== "extra_questions") {
    return NextResponse.json({ message: "Invalid product type" }, { status: 400 });
  }

  if ((type === "match_chat" || type === "extra_questions") && !chatSessionId) {
    return NextResponse.json({ message: "Missing chatSessionId" }, { status: 400 });
  }

  if (type === "match_chat" && !gameId) {
    return NextResponse.json({ message: "Missing gameId" }, { status: 400 });
  }

  if (type === "daily_pick" && getTodayPrediction().isNoEdgeDay) {
    return NextResponse.json({ message: "No edge day" }, { status: 403 });
  }

  const result = createCheckoutSession({
    email,
    type,
    gameId,
    chatSessionId,
  });

  return NextResponse.json({
    sessionId: result.id,
    amount: result.amount,
    currency: "USD",
    checkoutUrl: `/api/payments/mock-complete?sessionId=${result.id}`,
  });
}

