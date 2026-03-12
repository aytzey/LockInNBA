import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, validateDailyToken } from "@/lib/store";
import { issueAccessToken } from "@/lib/token";
import { getEstDateKey } from "@/lib/time";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = consumeMagicLink(token);
  if (!result) {
    return NextResponse.json({ message: "Invalid or expired link" }, { status: 410 });
  }

  if (!validateDailyToken(result.email)) {
    return NextResponse.json({ message: "No active purchase for this email" }, { status: 404 });
  }

  return NextResponse.json({
    accessToken: issueAccessToken({
      type: "daily",
      sub: result.email,
      date: getEstDateKey(),
    }),
  });
}
