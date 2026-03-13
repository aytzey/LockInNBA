import { NextResponse } from "next/server";
import { getSiteCopy } from "@/lib/store";

export async function GET() {
  const siteCopy = await getSiteCopy();

  return NextResponse.json({
    dailyCtaText: siteCopy.dailyCtaText,
    noEdgeMessage: siteCopy.noEdgeMessage,
    headerRightText: siteCopy.headerRightText,
    footerDisclaimer: siteCopy.footerDisclaimer,
  });
}
