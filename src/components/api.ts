import type { CheckoutType } from "./types";

export async function createCheckout(
  type: CheckoutType,
  email: string,
  gameId?: string,
  chatSessionId?: string,
): Promise<{ sessionId: string; amount: number }> {
  const res = await fetch("/api/payments/create-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, email, gameId, chatSessionId }),
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || "Could not create checkout");
  }
  return payload;
}

export async function finalizeCheckout(sessionId: string): Promise<string> {
  const res = await fetch("/api/payments/mock-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const payload = await res.json();
  if (!res.ok || !payload.accessToken) {
    throw new Error(payload.message || "Could not finalize payment");
  }
  return payload.accessToken as string;
}
