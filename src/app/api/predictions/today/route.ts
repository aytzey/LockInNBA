import { after, NextResponse } from "next/server";
import {
  predictionHasContent,
  predictionNeedsRefresh,
  refreshPredictionForDate,
} from "@/lib/daily-edge";
import { getTodayPrediction } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

export async function GET() {
  const date = getEstDateKey();
  const existing = await getTodayPrediction(date);

  // Never block the response on a slow LLM call.  Serve whatever is in the DB
  // right now and kick off generation / refresh in the background.
  if (!predictionHasContent(existing) || predictionNeedsRefresh(existing, false)) {
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
    isNoEdgeDay: existing.isNoEdgeDay,
    teaserText: existing.teaserText,
    hasPrediction: Boolean(existing.markdownContent.trim()),
    isBlurred: true,
  });
}
