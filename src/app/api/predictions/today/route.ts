import { after, NextResponse } from "next/server";
import {
  getOrCreateTodayPrediction,
  predictionHasContent,
  predictionNeedsRefresh,
  refreshPredictionForDate,
} from "@/lib/daily-edge";
import { getTodayPrediction } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

export async function GET() {
  const date = getEstDateKey();
  const existing = await getTodayPrediction(date);
  const prediction = predictionHasContent(existing) ? existing : await getOrCreateTodayPrediction(date);

  if (predictionHasContent(existing) && predictionNeedsRefresh(existing, false)) {
    after(async () => {
      try {
        await refreshPredictionForDate(date);
      } catch {
        // Keep serving the last good teaser if background refresh fails.
      }
    });
  }

  return NextResponse.json({
    date,
    isNoEdgeDay: prediction.isNoEdgeDay,
    teaserText: prediction.teaserText,
    hasPrediction: Boolean(prediction.markdownContent.trim()),
    isBlurred: true,
  });
}
