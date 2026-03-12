"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Game = {
  id: string;
  awayTeam: string;
  homeTeam: string;
  gameTimeEST: string;
  status: "upcoming" | "live" | "final";
  awayScore: number | null;
  homeScore: number | null;
  awayMoneyline: number;
  homeMoneyline: number;
  oddsSource: "DraftKings" | "FanDuel" | "BetMGM";
};

type TodayPrediction = {
  date: string;
  isNoEdgeDay: boolean;
  teaserText: string;
  hasPrediction: boolean;
};

type ChatMessage = {
  id: string;
  chatSessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ChatSessionState = {
  id: string;
  gameId: string;
  sessionToken: string;
  email: string | null;
  questionLimit: number;
  questionsUsed: number;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
};

type DailyResponse = {
  date: string;
  isNoEdgeDay: boolean;
  teaserText: string;
  hasPrediction: boolean;
};

type SocialProofResponse = {
  text: string;
};

type GamesResponse = {
  games: Game[];
};

type CheckoutType = "daily_pick" | "match_chat" | "extra_questions";

const DAILY_TOKEN_KEY = "lockin_daily_token";
const CHAT_TOKEN_PREFIX = "lockin_chat_token_";

function formatEstTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "TBD";
  return parsed.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatEstDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
  });
}

function todayEstLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
    year: "numeric",
    weekday: "short",
  });
}

function moneyline(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

function isPositiveMoneyline(v: number): boolean {
  return v > 0;
}

function statusBadgeClass(status: Game["status"]): string {
  if (status === "live") return "bg-[#ff3b3b] text-white";
  if (status === "final") return "bg-[#2a3142] text-[#8b92a5]";
  return "bg-[#1c2233] text-[#8b92a5]";
}

async function createCheckout(
  type: CheckoutType,
  email: string,
  gameId?: string,
  chatSessionId?: string,
): Promise<{ sessionId: string; amount: number }> {
  const res = await fetch("/api/payments/create-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      email,
      gameId,
      chatSessionId,
    }),
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || "Could not create checkout");
  }
  return payload;
}

async function finalizeCheckout(sessionId: string): Promise<string> {
  const res = await fetch("/api/payments/mock-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const payload = await res.json();
  if (!res.ok || !payload.accessToken) {
    throw new Error(payload.message || "Could not finalize payment");
  }
  return payload.accessToken as string;
}

function splitTeaser(text: string): { headline: string; body: string } {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const headline = lines.slice(0, 2).join(" ") || "Tonight's top edge is being evaluated...";
  const body = lines.slice(2).join("\n") || "Loading prediction data...";
  return { headline, body };
}

export default function HomePage() {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const gameSectionRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [todayPrediction, setTodayPrediction] = useState<TodayPrediction | null>(null);
  const [socialProof, setSocialProof] = useState<string>("");
  const [games, setGames] = useState<Game[]>([]);

  const [dailyMarkdown, setDailyMarkdown] = useState("");
  const [dailyUnlocked, setDailyUnlocked] = useState(false);
  const [dailyEmail, setDailyEmail] = useState("");
  const [unlockingDaily, setUnlockingDaily] = useState(false);
  const [dailyError, setDailyError] = useState("");

  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [chatSession, setChatSession] = useState<ChatSessionState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatToken, setChatToken] = useState<string | null>(null);
  const [chatQuestionsRemaining, setChatQuestionsRemaining] = useState(0);
  const [chatEmail, setChatEmail] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  const [isShareBusy, setIsShareBusy] = useState(false);
  const [shareMode, setShareMode] = useState<"daily" | "chat">("daily");

  const preview = splitTeaser(todayPrediction?.teaserText || "");

  useEffect(() => {
    async function init() {
      try {
        const [pRes, gRes, bRes] = await Promise.all([
          fetch("/api/predictions/today"),
          fetch("/api/games/today"),
          fetch("/api/social-proof"),
        ]);
        const [pBody, gBody, bBody] = await Promise.all([
          pRes.ok ? pRes.json() : Promise.resolve(null),
          gRes.ok ? gRes.json() : Promise.resolve(null),
          bRes.ok ? bRes.json() : Promise.resolve(null),
        ]);
        const prediction = (pBody as DailyResponse | null) || null;
        if (prediction) setTodayPrediction(prediction);
        if (gBody?.games) setGames((gBody as GamesResponse).games);
        setSocialProof((bBody as SocialProofResponse)?.text || "");

        const savedDailyToken = window.localStorage.getItem(DAILY_TOKEN_KEY);
        if (savedDailyToken) {
          await unlockDailyPrediction(savedDailyToken);
        }
      } finally {
        setIsLoading(false);
      }
    }

    init().catch(() => {});
  }, []);

  function isNoEdge() {
    return Boolean(todayPrediction?.isNoEdgeDay);
  }

  async function unlockDailyPrediction(token: string) {
    try {
      const res = await fetch("/api/predictions/unlock", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.localStorage.removeItem(DAILY_TOKEN_KEY);
          setDailyUnlocked(false);
          setDailyMarkdown("");
          return;
        }
        setDailyError(body.message || "Could not unlock");
        setDailyMarkdown("");
        return;
      }
      setDailyMarkdown(body.markdown || "");
      setDailyUnlocked(true);
      setDailyError("");
    } catch {
      setDailyError("Network error while unlocking.");
    }
  }

  async function handleDailyCheckout() {
    if (!dailyEmail || !dailyEmail.includes("@") || !dailyEmail.includes(".")) {
      setDailyError("Enter a valid email.");
      return;
    }
    setUnlockingDaily(true);
    setDailyError("");
    try {
      const checkout = await createCheckout("daily_pick", dailyEmail);
      const token = await finalizeCheckout(checkout.sessionId);
      window.localStorage.setItem(DAILY_TOKEN_KEY, token);
      await unlockDailyPrediction(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed";
      setDailyError(message);
    } finally {
      setUnlockingDaily(false);
    }
  }

  async function handleRestoreAccess() {
    if (!restoreEmail || !restoreEmail.includes("@") || !restoreEmail.includes(".")) {
      setRestoreMessage("Enter a valid email.");
      return;
    }
    setRestoreBusy(true);
    setRestoreMessage("");
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: restoreEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRestoreMessage(data.message || "No purchase found for this email.");
        return;
      }
      setRestoreMessage(`Magic link generated: ${data.magicLink}`);
      const verify = await fetch(data.magicLink);
      const verifyBody = await verify.json();
      if (!verify.ok || !verifyBody.accessToken) {
        throw new Error("Could not verify magic link.");
      }
      window.localStorage.setItem(DAILY_TOKEN_KEY, verifyBody.accessToken);
      await unlockDailyPrediction(verifyBody.accessToken);
    } catch {
      setRestoreMessage("Magic link validation failed. Use the link manually.");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function openChat(game: Game) {
    setChatError("");
    setIsChatOpen(true);
    setSelectedGame(game);
    try {
      const res = await fetch("/api/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.session) {
        throw new Error(data.message || "Could not open chat.");
      }
      const session = data.session as ChatSessionState;
      setChatSession(session);
      setChatQuestionsRemaining(data.questionsRemaining ?? 0);
      setChatMessages(data.messages ?? []);
      setChatEmail(session.email || "");
      const cachedToken = window.localStorage.getItem(`${CHAT_TOKEN_PREFIX}${session.id}`);
      setChatToken(cachedToken || null);
      setShareMode("chat");
      setChatInput("");
    } catch {
      setChatError("Could not open chat for this match.");
    }
  }

  async function refreshChatSession(sessionId: string) {
    const res = await fetch(`/api/chat/session/${sessionId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.session) {
      setChatSession(data.session as ChatSessionState);
      setChatQuestionsRemaining(data.questionsRemaining ?? 0);
    }
    if (Array.isArray(data.messages)) {
      setChatMessages(data.messages as ChatMessage[]);
    }
  }

  async function ensureChatPaid() {
    if (!chatSession || !chatEmail) return;
    if (chatSession?.isPaid && chatQuestionsRemaining > 0) return;
    try {
      const checkout = await createCheckout("match_chat", chatEmail, chatSession.gameId, chatSession.id);
      const token = await finalizeCheckout(checkout.sessionId);
      window.localStorage.setItem(`${CHAT_TOKEN_PREFIX}${chatSession.id}`, token);
      setChatToken(token);
      setChatError("");
      await refreshChatSession(chatSession.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed";
      setChatError(message);
    }
  }

  async function purchaseExtra() {
    if (!chatSession || !chatEmail) {
      setChatError("Enter your email and unlock first.");
      return;
    }
    try {
      const checkout = await createCheckout("extra_questions", chatEmail, chatSession.gameId, chatSession.id);
      const token = await finalizeCheckout(checkout.sessionId);
      window.localStorage.setItem(`${CHAT_TOKEN_PREFIX}${chatSession.id}`, token);
      setChatToken(token);
      await refreshChatSession(chatSession.id);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not unlock more questions.");
    }
  }

  async function sendChatMessage() {
    if (!selectedGame || !chatSession) return;
    if (!chatInput.trim()) return;
    if (chatQuestionsRemaining <= 0) {
      setChatError("Question limit reached.");
      return;
    }

    if (!chatToken) {
      setChatError("Payment required to start chat.");
      return;
    }

    setIsChatBusy(true);
    setChatError("");
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${chatToken}`,
        },
        body: JSON.stringify({
          sessionId: chatSession.id,
          message: chatInput.trim(),
          email: chatEmail,
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setChatError(data.message || "Payment required.");
        await refreshChatSession(chatSession.id);
        return;
      }
      if (!res.ok) {
        throw new Error(data.message || "Chat request failed.");
      }
      setChatMessages(data.messages as ChatMessage[]);
      setChatQuestionsRemaining(data.questionsRemaining ?? 0);
      setChatInput("");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Network error while sending.");
    } finally {
      setIsChatBusy(false);
    }
  }

  function closeChat() {
    setIsChatOpen(false);
    setSelectedGame(null);
    setChatSession(null);
    setChatMessages([]);
    setChatToken(null);
    setChatQuestionsRemaining(0);
    setChatInput("");
    setChatError("");
  }

  async function handleShare() {
    if (!shareCardRef.current) return;

    if (shareMode === "daily" && !dailyUnlocked) {
      setDailyError("Unlock today's lock first.");
      return;
    }

    setIsShareBusy(true);
    try {
      const h2c = (await import("html2canvas")).default;
      const canvas = await h2c(shareCardRef.current, { backgroundColor: "#0a0e1a", scale: 2 });
      const anchor = document.createElement("a");
      anchor.download = `lockin-insight-${Date.now()}.png`;
      anchor.href = canvas.toDataURL("image/png");
      anchor.click();
    } catch {
      setDailyError("Could not generate insight card.");
    } finally {
      setIsShareBusy(false);
    }
  }

  const noEdge = isNoEdge();

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 pb-16 text-sm md:px-8">
        <header className="flex items-center justify-between border border-white/10 bg-[#0f1524] px-3 py-3 md:px-5">
          <div className="flex items-center gap-2">
            <Image
              src="/lockin-logo.svg"
              alt="LOCKIN"
              width={124}
              height={40}
              priority
            />
          </div>
          <div className="mono text-xs text-[#8b92a5]">{todayEstLabel()}</div>
        </header>

        {socialProof && (
          <section className="rounded-lg border border-[#00c853]/35 bg-[#101a2c] p-3 text-center text-sm text-[#00ff87]">
            {socialProof}
          </section>
        )}

        <section className="lockin-card relative overflow-hidden rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="heading text-2xl text-white md:text-3xl">Tonight&apos;s Edge</h1>
            <span className="mono rounded-full border border-[#ffd700]/30 bg-black/40 px-3 py-1 text-[11px] text-[#ffd700]">
              {todayPrediction ? formatEstDate(todayPrediction.date) : "LIVE"}
            </span>
          </div>

          {isLoading ? (
            <p className="text-[#8b92a5]">Loading daily pick...</p>
          ) : noEdge ? (
            <div className="rounded-lg border border-[#ff6b35]/45 bg-[#0a0e1a] p-4 text-sm text-white">
              <p className="mb-3 text-lg font-semibold text-[#ff6b35]">
                SYSTEM ALERT: NO EDGE DETECTED TODAY
              </p>
              <p className="mb-4 leading-relaxed text-[#f5f5f3]">
                Our engine found no mathematical edge against Vegas tonight. We are not touts and
                won&apos;t force a daily lock for $5.
                Protect your bankroll — if you&apos;re still looking for action, open a matchup below and
                discuss it with AI for $2.
              </p>
              <button
                type="button"
                onClick={() => gameSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-lg bg-[#00c853] px-4 py-2 text-black transition hover:bg-[#00ff87]"
              >
                Open matchups and build your edge
              </button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-lg text-[#00ff87]">{preview.headline}</p>
              <div className="mb-4 rounded-md border border-white/10 bg-black/25 p-4">
                <div className="text-[#8b92a5] blurred">
                  {preview.body.split("\n").map((line) => (
                    <p className="leading-relaxed" key={line}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>

              {!dailyUnlocked ? (
                <>
                  <button
                    type="button"
                    onClick={handleDailyCheckout}
                    disabled={unlockingDaily}
                    className="w-full rounded-lg bg-[#00c853] px-4 py-3 text-lg font-semibold text-[#0a0e1a] transition hover:bg-[#00ff87] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {unlockingDaily ? "Unlocking..." : "Unlock Today's Edge — $5"}
                  </button>
                  <label className="mt-2 block text-xs text-[#8b92a5]">
                    Required for full prediction — enter email once to continue
                    <input
                      value={dailyEmail}
                      onChange={(event) => setDailyEmail(event.target.value)}
                      className="mt-1 w-full rounded border border-[#00c853]/40 bg-[#0f1524] px-3 py-2 text-white outline-none"
                      placeholder="you@email.com"
                    />
                  </label>
                </>
              ) : (
                <div className="rounded-lg border border-[#00c853]/25 bg-[#0f1524] p-4">
                  <div className="mb-2 heading text-sm text-[#00ff87]">Daily lock unlocked</div>
                  <div className="whitespace-pre-wrap text-[#f5f5f3]">{dailyMarkdown}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setShareMode("daily");
                      handleShare();
                    }}
                    disabled={isShareBusy}
                    className="mt-3 rounded-lg border border-[#00c853] px-3 py-2 text-[#00ff87] transition hover:bg-[#00c853]/15"
                  >
                    {isShareBusy ? "Generating..." : "Share your edge"}
                  </button>
                </div>
              )}
              {dailyError && <p className="mt-2 text-sm text-[#ff3b3b]">{dailyError}</p>}
            </>
          )}
        </section>

        <section ref={gameSectionRef} className="space-y-3">
          <h2 className="heading text-xl text-white">Matchups (Away @ Home)</h2>
          <p className="text-[#8b92a5]">
            Moneyline only • American odds • 1X2 unavailable
          </p>
          <div className="space-y-3">
            {games.map((game) => (
              <button
                key={game.id}
                type="button"
                onClick={() => openChat(game)}
                className="w-full rounded-lg border border-[#2a3852] bg-[#101a2c] p-4 text-left transition hover:border-[#00c853] focus:outline-none"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    <span>{game.awayTeam}</span>
                    <span className="mx-1 text-[#8b92a5]">@</span>
                    <span>{game.homeTeam}</span>
                  </div>
                  <span className={`mono rounded-full px-2 py-1 text-[11px] ${statusBadgeClass(game.status)}`}>
                    {game.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8b92a5]">
                  <span>{formatEstTime(game.gameTimeEST)} EST</span>
                  <span>{game.oddsSource}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className={`mono rounded bg-black/25 p-2 text-sm ${isPositiveMoneyline(game.awayMoneyline) ? "text-[#ff6b35]" : "text-[#00c853]"}`}>
                    Away ML {moneyline(game.awayMoneyline)}
                  </div>
                  <div className={`mono rounded bg-black/25 p-2 text-sm ${isPositiveMoneyline(game.homeMoneyline) ? "text-[#ff6b35]" : "text-[#00c853]"}`}>
                    Home ML {moneyline(game.homeMoneyline)}
                  </div>
                </div>
                {game.status === "final" && game.awayScore !== null && game.homeScore !== null ? (
                  <div className="mt-2 text-xs text-[#8b92a5]">
                    Final {game.awayScore}-{game.homeScore}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        <footer className="mt-6 space-y-3 rounded-lg border border-[#2a3852] bg-[#101a2c] px-4 py-4 text-xs text-[#8b92a5]">
          <div>
            Already paid?{" "}
            <button
              type="button"
              className="text-[#00ff87] underline"
              onClick={() => document.getElementById("restore")?.scrollIntoView({ behavior: "smooth" })}
            >
              Restore your access
            </button>
          </div>
          <div id="restore" className="space-y-2">
            <label className="block">
              <span>Email</span>
              <input
                value={restoreEmail}
                onChange={(event) => setRestoreEmail(event.target.value)}
                className="mt-1 w-full rounded border border-[#00c853]/30 bg-[#0f1524] p-2 text-white outline-none"
                placeholder="you@email.com"
              />
            </label>
            <button
              type="button"
              onClick={handleRestoreAccess}
              disabled={restoreBusy}
              className="rounded bg-[#ff6b35] px-3 py-2 text-black hover:bg-[#ff8a56] disabled:opacity-50"
            >
              {restoreBusy ? "Sending..." : "Send magic link"}
            </button>
            {restoreMessage ? <p className="text-[#f5f5f3]">{restoreMessage}</p> : null}
          </div>
          <p className="pt-2 text-[11px] text-[#f5f5f3]">
            For entertainment purposes only. Not financial advice. We do not accept wagers. If you or
            someone you know has a gambling problem, call 1-800-GAMBLER.
          </p>
        </footer>

        {isChatOpen && selectedGame ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-2xl rounded-lg border border-[#2a3852] bg-[#0a0e1a]">
              <div className="flex items-center justify-between border-b border-[#2a3852] px-4 py-3">
                <div>
                  <div className="heading text-lg">
                    {selectedGame.awayTeam} @ {selectedGame.homeTeam}
                  </div>
                  <div className="mono text-xs text-[#8b92a5]">
                    {formatEstTime(selectedGame.gameTimeEST)} EST • Away ML {moneyline(selectedGame.awayMoneyline)} / Home ML {moneyline(selectedGame.homeMoneyline)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeChat}
                  className="rounded border border-[#8b92a5]/40 px-3 py-1 text-[#8b92a5]"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[55vh] space-y-3 overflow-auto px-4 py-3">
                {chatError ? <p className="text-sm text-[#ff3b3b]">{chatError}</p> : null}
                {chatMessages.length === 0 ? (
                  <p className="rounded bg-[#101a2c] p-3 text-sm text-[#8b92a5]">
                    Start by unlocking chat for $2. Then get 3 question credits.
                  </p>
                ) : null}
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg p-3 ${
                      message.role === "user" ? "ml-auto max-w-[85%] bg-[#00c853]/20 text-[#f5f5f3]" : "bg-[#101a2c] text-[#f5f5f3]"
                    }`}
                  >
                    <div className="mono mb-1 text-[11px] opacity-70">{message.role}</div>
                    <div className="leading-relaxed whitespace-pre-wrap">{message.content}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#2a3852] px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-xs text-[#8b92a5]">
                  <span>
                    {chatQuestionsRemaining > 0
                      ? `${chatQuestionsRemaining} question${chatQuestionsRemaining === 1 ? "" : "s"} remaining`
                      : "No questions remaining"}
                  </span>
                  <span>Session: {chatSession?.isPaid ? "Active" : "Locked"}</span>
                </div>

                {(!chatSession?.isPaid || chatQuestionsRemaining <= 0) && (
                  <div className="mb-2 space-y-2">
                    <label className="block text-xs">
                      Email
                      <input
                        value={chatEmail}
                        onChange={(event) => setChatEmail(event.target.value)}
                        className="mt-1 w-full rounded border border-[#00c853]/30 bg-[#0f1524] p-2 text-white outline-none"
                        placeholder="you@email.com"
                      />
                    </label>
                    {!chatSession?.isPaid ? (
                      <button
                        type="button"
                        onClick={ensureChatPaid}
                        className="w-full rounded bg-[#00c853] px-3 py-2 text-black hover:bg-[#00ff87]"
                      >
                        Discuss this game with AI — $2
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={purchaseExtra}
                        className="w-full rounded bg-[#ff6b35] px-3 py-2 text-black hover:bg-[#ff8a56]"
                      >
                        +3 questions — $1
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendChatMessage();
                      }
                    }}
                    disabled={!chatSession?.isPaid || chatQuestionsRemaining <= 0 || isChatBusy}
                    className="flex-1 rounded border border-[#2a3852] bg-[#0f1524] px-3 py-2 text-white outline-none"
                    placeholder="Type your matchup question..."
                  />
                  <button
                    type="button"
                    onClick={sendChatMessage}
                    disabled={!chatSession?.isPaid || chatQuestionsRemaining <= 0 || isChatBusy}
                    className="rounded bg-[#00c853] px-3 py-2 text-black disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
                {chatSession?.isPaid && chatQuestionsRemaining > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShareMode("chat");
                      handleShare();
                    }}
                    disabled={isShareBusy}
                    className="mt-2 w-full rounded border border-[#00ff87] px-3 py-2 text-[#00ff87] hover:bg-[#00ff87]/10"
                  >
                    {isShareBusy ? "Generating..." : "Share your edge"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div
          aria-hidden="true"
          ref={shareCardRef}
          className="fixed left-[-9999px] top-[-9999px] z-0 w-[760px] bg-[#0a0e1a] p-6 text-sm"
        >
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <Image src="/lockin-logo.png" alt="LOCKIN" width={130} height={40} />
            <div className="mono text-xs text-[#8b92a5]">lockinpicks.ai</div>
          </div>
          {shareMode === "daily" ? (
            <div className="mt-4">
              <div className="heading mb-2 text-xl text-[#00ff87]">LOCKIN Daily Edge</div>
              <div className="text-[#8b92a5]">{preview.headline}</div>
              <p className="mt-3 whitespace-pre-wrap text-[#f5f5f3]">{dailyMarkdown}</p>
            </div>
          ) : (
            <div className="mt-4">
              <div className="heading mb-2 text-xl text-[#00ff87]">
                {selectedGame ? `${selectedGame.awayTeam} @ ${selectedGame.homeTeam} Insight` : "LOCKIN Match Insight"}
              </div>
              <div className="text-[#8b92a5]">
                {selectedGame
                  ? `Away ML ${moneyline(selectedGame.awayMoneyline)} / Home ML ${moneyline(selectedGame.homeMoneyline)}`
                  : ""}
              </div>
              <div className="mt-3 whitespace-pre-wrap text-[#f5f5f3]">
                {chatMessages
                  .filter((item) => item.role === "assistant")
                  .slice(-1)
                  .map((message) => message.content)
                  .join("\n") || "No chat summary yet."}
              </div>
            </div>
          )}
          <div className="mt-5 text-[12px] text-[#8b92a5]">Generated in-app preview</div>
        </div>
      </div>
    </main>
  );
}
