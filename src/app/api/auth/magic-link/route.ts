import { NextRequest, NextResponse } from "next/server";
import { createMagicLink } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = (body?.email || "").toLowerCase().trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Valid email required" }, { status: 400 });
  }

  const token = createMagicLink(email);
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

