import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin";
import { getSiteCopy, setSiteCopy } from "@/lib/store";

function isAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return Boolean(token && verifyAdminToken(token));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ siteCopy: await getSiteCopy() });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const siteCopy = await setSiteCopy({
    dailyCtaText: body?.dailyCtaText,
    noEdgeMessage: body?.noEdgeMessage,
    headerRightText: body?.headerRightText,
    footerDisclaimer: body?.footerDisclaimer,
  });

  return NextResponse.json({ siteCopy });
}
