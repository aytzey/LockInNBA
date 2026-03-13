import { NextResponse } from "next/server";
import { getActivePromoBanner } from "@/lib/store";

export async function GET() {
  const promoBanner = await getActivePromoBanner();

  return NextResponse.json({
    promoBanner: promoBanner
      ? {
          isActive: promoBanner.isActive,
          bannerText: promoBanner.bannerText,
          endDatetime: promoBanner.endDatetime,
        }
      : null,
  });
}
