import crypto from "node:crypto";

const API_BASE = "https://api.lemonsqueezy.com/v1";

function getApiKey(): string {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) throw new Error("LEMONSQUEEZY_API_KEY not configured");
  return key;
}

function getStoreId(): string {
  const id = process.env.LEMONSQUEEZY_STORE_ID;
  if (!id) throw new Error("LEMONSQUEEZY_STORE_ID not configured");
  return id;
}

const VARIANT_MAP: Record<string, string | undefined> = {
  daily_pick: process.env.LEMONSQUEEZY_VARIANT_DAILY_PICK,
  match_chat: process.env.LEMONSQUEEZY_VARIANT_MATCH_CHAT,
  extra_questions: process.env.LEMONSQUEEZY_VARIANT_EXTRA_QUESTIONS,
};

export function isLemonSqueezyConfigured(): boolean {
  return Boolean(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID);
}

export async function createLemonCheckout(opts: {
  type: "daily_pick" | "match_chat" | "extra_questions";
  email?: string;
  sessionId: string;
  redirectUrl: string;
}): Promise<string> {
  const variantId = VARIANT_MAP[opts.type];
  if (!variantId) throw new Error(`No Lemon Squeezy variant configured for ${opts.type}`);

  const checkoutData = {
    custom: {
      session_id: opts.sessionId,
    },
  } as {
    email?: string;
    custom: {
      session_id: string;
    };
  };

  if (opts.email?.trim()) {
    checkoutData.email = opts.email.trim().toLowerCase();
  }

  const res = await fetch(`${API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: checkoutData,
          checkout_options: {
            embed: true,
            media: false,
            desc: false,
          },
          product_options: {
            redirect_url: opts.redirectUrl,
          },
        },
        relationships: {
          store: {
            data: { type: "stores", id: getStoreId() },
          },
          variant: {
            data: { type: "variants", id: variantId },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lemon Squeezy API error: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.data.attributes.url as string;
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET not configured");

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const digest = hmac.digest("hex");

  if (digest.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
