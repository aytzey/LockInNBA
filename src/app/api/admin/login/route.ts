import { NextRequest, NextResponse } from "next/server";
import { issueAdminToken, verifyAdminCredentials } from "@/lib/admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = (body?.username || "").trim();
  const password = (body?.password || "").trim();

  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  return NextResponse.json({
    token: issueAdminToken(username),
  });
}

