import { NextRequest, NextResponse } from "next/server";
import { completeCheckout, createCheckoutSession, getActivePromoBanner, getPublicDailyEdgePreview } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";
import { isLemonSqueezyConfigured, createLemonCheckout } from "@/lib/lemonsqueezy";
import { issueAccessToken } from "@/lib/token";
import { getEstDateKey } from "@/lib/time";

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

  if (type !== "daily_pick" && type !== "match_chat" && type !== "extra_questions") {
    return NextResponse.json({ message: "Invalid product type" }, { status: 400 });
  }

  if ((type === "match_chat" || type === "extra_questions") && !chatSessionId) {
    return NextResponse.json({ message: "Missing chatSessionId" }, { status: 400 });
  }

  if (type === "match_chat" && !gameId) {
    return NextResponse.json({ message: "Missing gameId" }, { status: 400 });
  }

  if (type === "daily_pick") {
    const preview = await getPublicDailyEdgePreview();
    if (preview.isNoEdgeDay) {
      return NextResponse.json({ message: "No edge day" }, { status: 403 });
    }
    if (!preview.hasPrediction) {
      return NextResponse.json({ message: "Today's edge is still being prepared" }, { status: 403 });
    }
  }

  const activePromo = await getActivePromoBanner();
  const isFreePromoFlow = Boolean(activePromo && (type === "daily_pick" || type === "match_chat"));

  if (isFreePromoFlow && !email) {
    return NextResponse.json({ message: "Email is required during free access week" }, { status: 400 });
  }

  const result = await createCheckoutSession({
    email: email || undefined,
    type,
    gameId,
    chatSessionId,
  });

  if (isFreePromoFlow) {
    const payment = await completeCheckout(result.id, `promo_${Date.now()}`, email);
    if (!payment) {
      return NextResponse.json({ message: "Could not grant promo access" }, { status: 500 });
    }

    const accessToken =
      payment.type === "daily_pick"
        ? issueAccessToken({
            type: "daily",
            sub: payment.stripeCustomerEmail,
            date: getEstDateKey(new Date(payment.grantedAt)),
          })
        : issueAccessToken({
            type: "chat",
            sub: payment.stripeCustomerEmail,
            date: getEstDateKey(new Date(payment.grantedAt)),
            sessionId: payment.metadata.chatSessionId,
            gameId: payment.metadata.gameId,
          });

    return NextResponse.json({
      sessionId: result.id,
      amount: 0,
      currency: "USD",
      checkoutUrl: "__free__",
      accessToken,
    });
  }

  if (isLemonSqueezyConfigured()) {
    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const checkoutUrl = await createLemonCheckout({
      type,
      email: email || undefined,
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
