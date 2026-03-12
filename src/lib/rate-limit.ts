const bucket = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip = "global", limit = 10, windowMs = 60 * 1000): boolean {
  const now = Date.now();
  const current = bucket.get(ip);
  if (!current || current.resetAt < now) {
    bucket.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count += 1;
  bucket.set(ip, current);
  return true;
}

