import { NextResponse } from "next/server";
import { DEFAULT_SOCIAL_PROOF_TEXT, getSocialProofBanner } from "@/lib/store";

export async function GET() {
  const banner = await getSocialProofBanner();
  return NextResponse.json({
    text: banner?.text || DEFAULT_SOCIAL_PROOF_TEXT,
    isActive: true,
  });
}
