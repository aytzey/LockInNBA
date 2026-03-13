import { NextResponse } from "next/server";
import { getPublicPredictionPreview } from "@/lib/daily-edge";
import { getEstDateKey } from "@/lib/time";

export async function GET() {
  const date = getEstDateKey();
  const prediction = await getPublicPredictionPreview(date);

  return NextResponse.json({
    date,
    isNoEdgeDay: prediction.isNoEdgeDay,
    teaserText: prediction.teaserText,
    hasPrediction: Boolean(prediction.markdownContent.trim()),
    isBlurred: true,
  });
}
