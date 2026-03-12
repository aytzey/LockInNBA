import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin";
import { getActiveSystemPrompt, listSystemPrompts, saveSystemPrompt } from "@/lib/store";

function isAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return Boolean(token && verifyAdminToken(token));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    active: await getActiveSystemPrompt(),
    history: await listSystemPrompts(),
  });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const content = (body?.content || "").toString().trim();
  if (!content) {
    return NextResponse.json({ message: "content required" }, { status: 400 });
  }

  const prompt = await saveSystemPrompt(content);
  return NextResponse.json({ prompt });
}
