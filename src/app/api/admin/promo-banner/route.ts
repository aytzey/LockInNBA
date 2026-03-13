import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin";
import { getPromoBanner, setPromoBanner } from "@/lib/store";

function isAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return Boolean(token && verifyAdminToken(token));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ promoBanner: await getPromoBanner() });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const promoBanner = await setPromoBanner({
    isActive: Boolean(body?.isActive),
    bannerText: (body?.bannerText || "").toString(),
    endDatetime: (body?.endDatetime || "").toString(),
  });

  return NextResponse.json({ promoBanner });
}
