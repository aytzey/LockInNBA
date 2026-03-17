import { NextResponse } from "next/server";
import { getResolvedTrackRecordMarkdown, getSiteCopy } from "@/lib/store";

export async function GET() {
  const [siteCopy, trackRecordMarkdown] = await Promise.all([
    getSiteCopy(),
    getResolvedTrackRecordMarkdown(),
  ]);

  return NextResponse.json({
    dailyCtaText: siteCopy.dailyCtaText,
    dailyPriceSubtext: siteCopy.dailyPriceSubtext,
    noEdgeMessage: siteCopy.noEdgeMessage,
    headerRightText: siteCopy.headerRightText,
    metaDescription: siteCopy.metaDescription,
    footerDisclaimer: siteCopy.footerDisclaimer,
    trackRecordMarkdown,
  });
}
