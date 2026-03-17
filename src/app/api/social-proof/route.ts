import { NextResponse } from "next/server";
import { DEFAULT_SOCIAL_PROOF_TEXT, getPublicSocialProofMessages } from "@/lib/store";

export async function GET() {
  const messages = await getPublicSocialProofMessages();
  const normalizedMessages = messages.length
    ? messages
    : DEFAULT_SOCIAL_PROOF_TEXT.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  return NextResponse.json({
    text: normalizedMessages[0] || DEFAULT_SOCIAL_PROOF_TEXT,
    messages: normalizedMessages,
    isActive: true,
  });
}
