import { NextRequest, NextResponse } from "next/server";
import { completeCheckout, getCheckoutSession } from "@/lib/store";
import { issueAccessToken, generateMagicLinkToken } from "@/lib/token";
import { getEstDateKey } from "@/lib/time";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId as string | undefined;
  const stripePaymentId = body?.stripePaymentId || generateMagicLinkToken(8);

  if (!sessionId) {
    return NextResponse.json({ message: "Missing sessionId" }, { status: 400 });
  }

  const checkout = getCheckoutSession(sessionId);
  if (!checkout) {
    return NextResponse.json({ message: "Session not found" }, { status: 404 });
  }

  const payment = completeCheckout(sessionId, stripePaymentId);
  if (!payment) {
    return NextResponse.json({ message: "Checkout already completed" }, { status: 409 });
  }

  const tokenPayload =
    payment.type === "daily_pick"
      ? {
          type: "daily" as const,
          sub: payment.stripeCustomerEmail,
          date: getEstDateKey(new Date(payment.grantedAt)),
        }
      : {
          type: "chat" as const,
          sub: payment.stripeCustomerEmail,
          date: getEstDateKey(new Date(payment.grantedAt)),
          sessionId: payment.metadata.chatSessionId,
          gameId: payment.metadata.gameId,
        };

  return NextResponse.json({
    payment,
    accessToken: issueAccessToken(tokenPayload),
  });
}
