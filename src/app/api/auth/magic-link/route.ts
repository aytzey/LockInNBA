import { NextRequest, NextResponse } from "next/server";
import { createMagicLink } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(`magic:${ip}`, 5, 60_000)) {
    return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const email = (body?.email || "").toLowerCase().trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Valid email required" }, { status: 400 });
  }

  const token = await createMagicLink(email);
  if (!token) {
    return NextResponse.json(
      {
        message: "No active purchase found for this email",
      },
      { status: 404 },
    );
  }

  const magicLink = `/api/auth/verify-magic/${token}`;
  return NextResponse.json({
    message: "Magic link generated",
    magicLink,
  });
}
