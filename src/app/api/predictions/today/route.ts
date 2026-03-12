import { NextResponse } from "next/server";
import { getTodayPrediction } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

export async function GET() {
  const date = getEstDateKey();
  const prediction = getTodayPrediction(date);

  return NextResponse.json({
    date,
    isNoEdgeDay: prediction.isNoEdgeDay,
    teaserText: prediction.teaserText,
    hasPrediction: Boolean(prediction.markdownContent.trim()),
    // Anti-hack: only dummy/teaser text is sent here.
    isBlurred: true,
  });
}

