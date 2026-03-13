import { NextRequest, NextResponse } from "next/server";
import { getOrCreateTodayPrediction } from "@/lib/daily-edge";
import { createCheckoutSession } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";
import { isLemonSqueezyConfigured, createLemonCheckout } from "@/lib/lemonsqueezy";

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

  if (type === "daily_pick" && (await getOrCreateTodayPrediction()).isNoEdgeDay) {
    return NextResponse.json({ message: "No edge day" }, { status: 403 });
  }

  const result = await createCheckoutSession({
    email,
    type,
    gameId,
    chatSessionId,
  });

  if (isLemonSqueezyConfigured()) {
    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const checkoutUrl = await createLemonCheckout({
      type,
      email,
      sessionId: result.id,
      redirectUrl: `${origin}/checkout-success?session_id=${result.id}`,
    });

    return NextResponse.json({
      sessionId: result.id,
      amount: result.amount,
      currency: "USD",
      checkoutUrl,
    });
  }

  // Fallback: mock checkout for local development
  return NextResponse.json({
    sessionId: result.id,
    amount: result.amount,
    currency: "USD",
    checkoutUrl: `__mock__`,
  });
}
