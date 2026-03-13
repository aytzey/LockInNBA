import { NextRequest, NextResponse } from "next/server";
import { completeCheckout, getCheckoutSession } from "@/lib/store";
import { verifyWebhookSignature } from "@/lib/lemonsqueezy";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") || "";

  try {
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ message: "Webhook verification failed" }, { status: 500 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const meta = payload.meta as Record<string, unknown> | undefined;
  const eventName = meta?.event_name;

  if (eventName !== "order_created") {
    return NextResponse.json({ ok: true });
  }

  const customData = meta?.custom_data as Record<string, string> | undefined;
  const sessionId = customData?.session_id;
  if (!sessionId) {
    return NextResponse.json({ message: "Missing session_id in custom data" }, { status: 400 });
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const orderId = String(data?.id || `ls_${Date.now()}`);
  const attributes = (data?.attributes as Record<string, unknown> | undefined) ?? {};
  const customerEmail =
    typeof attributes.user_email === "string" && attributes.user_email.trim().length > 0
      ? attributes.user_email.trim().toLowerCase()
      : undefined;

  const checkout = await getCheckoutSession(sessionId);
  if (!checkout) {
    return NextResponse.json({ message: "Session not found" }, { status: 404 });
  }

  if (checkout.status === "paid") {
    return NextResponse.json({ ok: true });
  }

  await completeCheckout(sessionId, `ls_${orderId}`, customerEmail);

  return NextResponse.json({ ok: true });
}
