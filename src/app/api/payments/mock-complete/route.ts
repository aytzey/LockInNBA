import { NextRequest, NextResponse } from "next/server";
import { completeCheckout, getCheckoutSession } from "@/lib/store";
import { issueAccessToken } from "@/lib/token";
import { getEstDateKey } from "@/lib/time";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId as string | undefined;

  if (!sessionId) {
    return NextResponse.json({ message: "Missing sessionId" }, { status: 400 });
  }

  const checkout = await getCheckoutSession(sessionId);
  if (!checkout) {
    return NextResponse.json({ message: "Checkout session not found" }, { status: 404 });
  }

  if (checkout.status === "paid") {
    return NextResponse.json({ message: "Session already paid" }, { status: 409 });
  }

  const payment = await completeCheckout(sessionId, `mock_${Date.now()}`);
  if (!payment) {
    return NextResponse.json({ message: "Payment could not be completed" }, { status: 400 });
  }

  const accessTokenPayload =
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
    accessToken: issueAccessToken(accessTokenPayload),
  });
}
