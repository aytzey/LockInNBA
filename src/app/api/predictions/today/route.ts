import { NextResponse } from "next/server";
import { getOrCreateTodayPrediction } from "@/lib/daily-edge";
import { getEstDateKey } from "@/lib/time";

export async function GET() {
  const date = getEstDateKey();
  const prediction = await getOrCreateTodayPrediction(date);

  return NextResponse.json({
    date,
    isNoEdgeDay: prediction.isNoEdgeDay,
    teaserText: prediction.teaserText,
    hasPrediction: Boolean(prediction.markdownContent.trim()),
    isBlurred: true,
  });
}
