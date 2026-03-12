import { NextResponse } from "next/server";
import { getSocialProofBanner } from "@/lib/store";

export async function GET() {
  const banner = getSocialProofBanner();
  return NextResponse.json({
    text: banner?.text ?? "",
    isActive: Boolean(banner),
  });
}

