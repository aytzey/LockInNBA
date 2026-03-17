import { NextRequest, NextResponse } from "next/server";
import { getUnlockedDailyEdge, validateDailyToken } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";
import { verifyAccessToken, parseBearerToken } from "@/lib/token";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip, 10)) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const token = verifyAccessToken(parseBearerToken(request.headers.get("authorization")));
  if (!token) {
    return NextResponse.json({ message: "Missing token" }, { status: 401 });
  }

  if (token.type !== "daily") {
    return NextResponse.json({ message: "Invalid token type" }, { status: 403 });
  }

  const date = getEstDateKey();
  if (token.date && token.date !== date) {
    return NextResponse.json({ message: "Token expired for this day" }, { status: 403 });
  }

  if (!(await validateDailyToken(token.sub))) {
    return NextResponse.json({ message: "No active payment found" }, { status: 403 });
  }

  const unlockedEdge = await getUnlockedDailyEdge(date);
  if (unlockedEdge.preview.isNoEdgeDay) {
    return NextResponse.json({ message: "No edge day" }, { status: 403 });
  }
  if (!unlockedEdge.preview.hasPrediction || unlockedEdge.picks.length === 0) {
    return NextResponse.json({ message: "Today's edge is still being prepared" }, { status: 403 });
  }

  return NextResponse.json({
    picks: unlockedEdge.picks,
    markdown: unlockedEdge.markdown,
    source: "verified-session",
  });
}
