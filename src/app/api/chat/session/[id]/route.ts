import { NextResponse } from "next/server";
import { getChatSession, getChatMessages, remainingQuestions } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getChatSession(id);
  if (!session) {
    return NextResponse.json({ message: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    session,
    questionsRemaining: remainingQuestions(id),
    messages: getChatMessages(id),
  });
}

