import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getOptionalEnv } from "@/lib/env";
import { refreshLiveData } from "@/lib/daily-edge";
import { getEstDateKey, shiftEstDateKey } from "@/lib/time";
import { parseBearerToken } from "@/lib/token";

function readSyncSecret(): string | null {
  return getOptionalEnv("LOCKIN_SYNC_SECRET") || getOptionalEnv("CRON_SECRET");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function isAuthorized(request: NextRequest, expectedSecret: string): boolean {
  const bearer = parseBearerToken(request.headers.get("authorization"));
  const querySecret = request.nextUrl.searchParams.get("secret");
  const candidate = bearer || querySecret;

  if (!candidate) {
    return false;
  }

  return safeEqual(candidate, expectedSecret);
}

export async function GET(request: NextRequest) {
  const secret = readSyncSecret();
  if (!secret) {
    return NextResponse.json(
      { message: "Missing LOCKIN_SYNC_SECRET or CRON_SECRET" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const baseDate = request.nextUrl.searchParams.get("date") || getEstDateKey();
  const includeTomorrow = ["1", "true", "yes"].includes(
    (request.nextUrl.searchParams.get("includeTomorrow") || "").toLowerCase(),
  );
  const forcePrediction = ["1", "true", "yes"].includes(
    (request.nextUrl.searchParams.get("forcePrediction") || "").toLowerCase(),
  );

  const dates = includeTomorrow
    ? [baseDate, shiftEstDateKey(baseDate, 1)]
    : [baseDate];

  const results = await refreshLiveData(dates, forcePrediction);

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    dates: results,
  });
}
