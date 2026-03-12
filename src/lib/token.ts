import crypto from "node:crypto";
import { AccessTokenPayload } from "./types";

const APP_SECRET = process.env.LOCKIN_TOKEN_SECRET || "lockin-dev-secret";

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", APP_SECRET).update(value).digest("base64url");
}

export function issueAccessToken(payload: Omit<AccessTokenPayload, "iat" | "exp">, ttlMs = 24 * 60 * 60 * 1000): string {
  const now = Date.now();
  const basePayload: AccessTokenPayload = {
    ...payload,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + ttlMs) / 1000),
  };

  const body = base64UrlEncode(JSON.stringify(basePayload));
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifyAccessToken(token: string | null): AccessTokenPayload | null {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [body, signature] = token.split(".");
  const expected = sign(body);
  if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  let parsed: AccessTokenPayload;
  try {
    parsed = JSON.parse(base64UrlDecode(body)) as AccessTokenPayload;
  } catch {
    return null;
  }

  if (!parsed?.sub || !parsed?.type) {
    return null;
  }

  if (parsed.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return parsed;
}

export function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  if (!headerValue.startsWith("Bearer ")) return null;
  return headerValue.slice(7);
}

export function generateMagicLinkToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}
