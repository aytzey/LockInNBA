import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession } from "@/lib/store";
import { issueAccessToken } from "@/lib/token";
import { getEstDateKey } from "@/lib/time";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ message: "Missing sessionId" }, { status: 400 });
  }

  const checkout = await getCheckoutSession(sessionId);
  if (!checkout) {
    return NextResponse.json({ message: "Session not found" }, { status: 404 });
  }

  if (checkout.status !== "paid") {
    return NextResponse.json({ paid: false });
  }

  const tokenPayload =
    checkout.type === "daily_pick"
      ? {
          type: "daily" as const,
          sub: checkout.email,
          date: getEstDateKey(),
        }
      : {
          type: "chat" as const,
          sub: checkout.email,
          date: getEstDateKey(),
          sessionId: checkout.chatSessionId!,
          gameId: checkout.gameId!,
        };

  return NextResponse.json({
    paid: true,
    accessToken: issueAccessToken(tokenPayload),
  });
}
