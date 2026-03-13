import { NextResponse } from "next/server";
import { getSiteCopy } from "@/lib/store";

export async function GET() {
  const siteCopy = await getSiteCopy();

  return NextResponse.json({
    dailyCtaText: siteCopy.dailyCtaText,
    dailyPriceSubtext: siteCopy.dailyPriceSubtext,
    noEdgeMessage: siteCopy.noEdgeMessage,
    headerRightText: siteCopy.headerRightText,
    metaDescription: siteCopy.metaDescription,
    footerDisclaimer: siteCopy.footerDisclaimer,
  });
}
