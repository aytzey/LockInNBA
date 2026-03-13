import { NextRequest, NextResponse } from "next/server";
import { sendMagicLinkEmail, getMailFromAddress } from "@/lib/email";
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
  const magicLinkUrl = new URL(magicLink, request.nextUrl.origin || "http://localhost:3000").toString();

  if (getMailFromAddress()) {
    try {
      await sendMagicLinkEmail({
        to: email,
        magicLinkUrl,
      });

      return NextResponse.json({
        message: "Check your inbox for your restore link.",
        delivery: "email",
      });
    } catch (error) {
      console.error("Magic link email send failed", error);
    }
  }

  return NextResponse.json({
    message: getMailFromAddress()
      ? "Email delivery unavailable. Restoring access in browser."
      : "Magic link generated",
    delivery: "direct_link",
    magicLink,
  });
}
