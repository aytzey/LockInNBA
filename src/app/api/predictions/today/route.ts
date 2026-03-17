import { NextResponse } from "next/server";
import { getPublicDailyEdgePreview } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

export async function GET() {
  const date = getEstDateKey();
  return NextResponse.json(await getPublicDailyEdgePreview(date));
}
