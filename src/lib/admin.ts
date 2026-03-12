import crypto from "node:crypto";

const ADMIN_USERNAME = process.env.LOCKIN_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.LOCKIN_ADMIN_PASSWORD || "lockin-admin";
const ADMIN_SECRET = process.env.LOCKIN_ADMIN_SECRET || "lockin-admin-secret";

const passwordHash = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest("hex");

interface AdminAuthPayload {
  u: string;
  role: "admin";
  iat: number;
  exp: number;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", ADMIN_SECRET).update(value).digest("base64url");
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const passHash = crypto.createHash("sha256").update(password).digest("hex");
  return username === ADMIN_USERNAME && passHash === passwordHash;
}

export function issueAdminToken(username: string): string {
  const payload: AdminAuthPayload = {
    u: username,
    role: "admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + 8 * 60 * 60 * 1000) / 1000),
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminToken(token: string | null): boolean {
  if (!token || !token.includes(".")) return false;
  const [payloadB64, sig] = token.split(".");
  if (!sig) return false;
  if (!timingSafeEqualBase64(sign(payloadB64), sig)) return false;

  let payload: AdminAuthPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64)) as AdminAuthPayload;
  } catch {
    return false;
  }

  if (payload.role !== "admin") return false;
  if (payload.exp < Math.floor(Date.now() / 1000)) return false;
  return payload.u === ADMIN_USERNAME;
}

function timingSafeEqualBase64(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
