import { NextResponse } from "next/server";
import { DEFAULT_SOCIAL_PROOF_TEXT, getSocialProofBanner } from "@/lib/store";

export async function GET() {
  const banner = await getSocialProofBanner();
  const messages = banner?.messages || DEFAULT_SOCIAL_PROOF_TEXT.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  return NextResponse.json({
    text: messages[0] || DEFAULT_SOCIAL_PROOF_TEXT,
    messages,
    isActive: true,
  });
}
