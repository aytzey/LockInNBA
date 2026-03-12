import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin";
import { deletePrediction, listPredictions, savePrediction } from "@/lib/store";

function isAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return Boolean(token && verifyAdminToken(token));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ predictions: listPredictions() });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const date = (body?.date || "").trim();
  const markdownContent = (body?.markdownContent || "").trim();
  const teaserText = (body?.teaserText || "").trim();
  const isNoEdgeDay = Boolean(body?.isNoEdgeDay);

  if (!date) {
    return NextResponse.json({ message: "date is required" }, { status: 400 });
  }

  if (!isNoEdgeDay && (!markdownContent || !teaserText)) {
    return NextResponse.json({ message: "teaserText and markdownContent are required" }, { status: 400 });
  }

  const normalizedTeaserText = isNoEdgeDay ? teaserText || "No edge lock today." : teaserText;
  const normalizedMarkdown = isNoEdgeDay
    ? markdownContent || "No official lock today. Protect your bankroll and only play your game."
    : markdownContent;

  const prediction = savePrediction({
    id: body.id,
    date,
    teaserText: normalizedTeaserText,
    markdownContent: normalizedMarkdown,
    isNoEdgeDay,
  });

  return NextResponse.json({ prediction });
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ message: "id required" }, { status: 400 });
  deletePrediction(id);
  return NextResponse.json({ success: true });
}
