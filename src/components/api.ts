import type { CheckoutType } from "./types";

export interface CheckoutStatusResult {
  paid: boolean;
  accessToken: string | null;
  type?: CheckoutType;
  chatSessionId?: string | null;
  gameId?: string | null;
}

export async function createCheckout(
  type: CheckoutType,
  email: string,
  gameId?: string,
  chatSessionId?: string,
): Promise<{ sessionId: string; amount: number; checkoutUrl: string }> {
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

export async function pollCheckoutStatus(sessionId: string): Promise<CheckoutStatusResult> {
  const res = await fetch(`/api/payments/status?sessionId=${sessionId}`);
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.message || "Could not check status");
  return {
    paid: Boolean(payload.paid),
    accessToken: payload.paid ? (payload.accessToken as string) : null,
    type: payload.type as CheckoutType | undefined,
    chatSessionId: (payload.chatSessionId as string | null | undefined) ?? null,
    gameId: (payload.gameId as string | null | undefined) ?? null,
  };
}

export function waitForCheckout(sessionId: string, timeoutMs = 300_000): Promise<CheckoutStatusResult> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(async () => {
      try {
        const result = await pollCheckoutStatus(sessionId);
        if (result.accessToken) {
          clearInterval(interval);
          resolve(result);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error("Payment verification timed out. Check your email for access."));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 2500);
  });
}

/** Mock-complete for local dev when Lemon Squeezy is not configured */
export async function mockComplete(sessionId: string): Promise<string> {
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
