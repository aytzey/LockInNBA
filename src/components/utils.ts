export function formatEstTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "TBD";
  return parsed.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatEstDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
  });
}

export function todayEstLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
    year: "numeric",
    weekday: "short",
  });
}

export function moneyline(v: number): string {
  if (v === 0) return "OFF";
  return v > 0 ? `+${v}` : `${v}`;
}

export function isPositiveMoneyline(v: number): boolean {
  return v > 0;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const DAILY_TOKEN_KEY = "lockin_daily_token";
export const CHAT_TOKEN_PREFIX = "lockin_chat_token_";
export const CHAT_SESSION_RESTORE_PREFIX = "lockin_chat_session_restore_";
export const LEAD_EMAIL_KEY = "lockin_lead_email";
