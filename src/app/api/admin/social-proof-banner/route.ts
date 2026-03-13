import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin";
import { getSocialProofBanner, setSocialProofBanner } from "@/lib/store";

function isAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return Boolean(token && verifyAdminToken(token));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const banner = await getSocialProofBanner();
  return NextResponse.json({
    banner: banner?.messages?.[0] || "",
    messages: banner?.messages || [],
  });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const messages = Array.isArray(body?.messages)
    ? body.messages
    : (body?.text || "").toString();
  const banner = await setSocialProofBanner(messages);
  return NextResponse.json({ banner });
}
