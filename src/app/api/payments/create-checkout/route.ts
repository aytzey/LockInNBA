import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, getTodayPrediction } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json();
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

