import { NextResponse } from "next/server";
import { getHomepageBootstrap } from "@/lib/homepage";
import { getEstDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const bootstrap = await getHomepageBootstrap(getEstDateKey());

    return NextResponse.json(
      bootstrap,
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (err) {
    console.warn("[LOCKIN] bootstrap route error:", err);
    return NextResponse.json(
      { error: "bootstrap_failed" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
