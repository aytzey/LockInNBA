import { NextResponse } from "next/server";
import { getChatSession, getChatMessages, getMatchMarkdown, remainingQuestions } from "@/lib/store";
import { getEstDateKey } from "@/lib/time";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getChatSession(id);
  if (!session) {
    return NextResponse.json({ message: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    session,
    questionsRemaining: await remainingQuestions(id),
    messages: await getChatMessages(id),
    hasMatchMarkdown: Boolean(await getMatchMarkdown(session.gameId, getEstDateKey())),
  });
}
