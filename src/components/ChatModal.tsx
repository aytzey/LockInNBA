"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import type { Game, ChatMessage, ChatSessionState } from "./types";
import {
  CHAT_SESSION_RESTORE_PREFIX,
  CHAT_TOKEN_PREFIX,
  LEAD_EMAIL_KEY,
  formatEstTime,
  moneyline,
  validateEmail,
} from "./utils";
import { createCheckout, waitForCheckout, mockComplete } from "./api";
import MarkdownContent from "./MarkdownContent";

interface ChatModalProps {
  game: Game;
  promoActive: boolean;
  onClose: () => void;
  onShareRequest: () => void;
  isShareBusy: boolean;
  onMessagesChange: (messages: ChatMessage[]) => void;
}

export default function ChatModal({
  game,
  promoActive,
  onClose,
  onShareRequest,
  isShareBusy,
  onMessagesChange,
}: ChatModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [chatSession, setChatSession] = useState<ChatSessionState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatToken, setChatToken] = useState<string | null>(null);
  const [chatQuestionsRemaining, setChatQuestionsRemaining] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [leadEmail, setLeadEmail] = useState("");
  const [hasMatchMarkdown, setHasMatchMarkdown] = useState(true);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [isUnlockingQuestion, setIsUnlockingQuestion] = useState(false);

  useEffect(() => {
    try {
      setLeadEmail(window.localStorage.getItem(LEAD_EMAIL_KEY) || "");
    } catch {
      // Ignore local storage failures.
    }
  }, []);

  useEffect(() => {
    if (!leadEmail.trim()) {
      return;
    }

    try {
      window.localStorage.setItem(LEAD_EMAIL_KEY, leadEmail.trim());
    } catch {
      // Ignore local storage failures.
    }
  }, [leadEmail]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  useEffect(() => {
    if (!isInitializing && !showEmailCapture) {
      inputRef.current?.focus();
    }
  }, [isInitializing, showEmailCapture]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    async function initSession() {
      try {
        const cachedLeadEmail = (() => {
          try {
            return window.localStorage.getItem(LEAD_EMAIL_KEY) || "";
          } catch {
            return "";
          }
        })();
        const restoredSessionId = window.localStorage.getItem(`${CHAT_SESSION_RESTORE_PREFIX}${game.id}`);
        if (restoredSessionId) {
          const restoredResponse = await fetch(`/api/chat/session/${restoredSessionId}`);
          const restoredData = await restoredResponse.json().catch(() => null);
          if (restoredResponse.ok && restoredData?.session?.gameId === game.id) {
            const session = restoredData.session as ChatSessionState;
            setChatSession(session);
            if (session.email) {
              setLeadEmail(session.email);
            }
            setChatQuestionsRemaining(restoredData.questionsRemaining ?? 0);
            setChatMessages(restoredData.messages ?? []);
            setHasMatchMarkdown(restoredData.hasMatchMarkdown ?? true);
            onMessagesChange(restoredData.messages ?? []);
            const restoredToken = window.localStorage.getItem(`${CHAT_TOKEN_PREFIX}${session.id}`);
            setChatToken(restoredToken || null);
            return;
          }

          window.localStorage.removeItem(`${CHAT_SESSION_RESTORE_PREFIX}${game.id}`);
        }

        const res = await fetch("/api/chat/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: game.id, email: cachedLeadEmail }),
        });
        const data = await res.json();
        if (!res.ok || !data.session) {
          throw new Error(data.message || "Could not open chat.");
        }
        const session = data.session as ChatSessionState;
        setChatSession(session);
        if (session.email) {
          setLeadEmail(session.email);
        }
        setChatQuestionsRemaining(data.questionsRemaining ?? 0);
        setChatMessages(data.messages ?? []);
        setHasMatchMarkdown(data.hasMatchMarkdown ?? true);
        onMessagesChange(data.messages ?? []);
        const cachedToken = window.localStorage.getItem(`${CHAT_TOKEN_PREFIX}${session.id}`);
        setChatToken(cachedToken || null);
      } catch {
        setChatError("Could not open chat for this match.");
      } finally {
        setIsInitializing(false);
      }
    }
    initSession();
  }, [game.id, onMessagesChange]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  async function refreshChatSession(sessionId: string) {
    const res = await fetch(`/api/chat/session/${sessionId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.session) {
      setChatSession(data.session as ChatSessionState);
      setChatQuestionsRemaining(data.questionsRemaining ?? 0);
      setHasMatchMarkdown(data.hasMatchMarkdown ?? true);
    }
    if (Array.isArray(data.messages)) {
      const nextMessages = data.messages as ChatMessage[];
      setChatMessages(nextMessages);
      onMessagesChange(nextMessages);
    }
  }

  async function resolveSessionByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
      return null;
    }

    const response = await fetch("/api/chat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: game.id, email: normalizedEmail }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.session) {
      throw new Error(body?.message || "Could not sync this matchup session.");
    }

    const session = body.session as ChatSessionState;
    setChatSession(session);
    if (session.email) {
      setLeadEmail(session.email);
    }
    setChatQuestionsRemaining(body.questionsRemaining ?? 0);
    setHasMatchMarkdown(body.hasMatchMarkdown ?? true);
    setChatMessages(Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : []);
    onMessagesChange(Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : []);

    try {
      window.localStorage.setItem(`${CHAT_SESSION_RESTORE_PREFIX}${game.id}`, session.id);
      setChatToken(window.localStorage.getItem(`${CHAT_TOKEN_PREFIX}${session.id}`) || null);
    } catch {
      setChatToken(null);
    }

    return {
      session,
      questionsRemaining: body.questionsRemaining ?? 0,
    };
  }

  async function openCheckoutAndWait(
    type: "match_chat" | "extra_questions",
    email?: string,
    sessionOverride?: ChatSessionState | null,
  ) {
    const activeSession = sessionOverride ?? chatSession;
    if (!activeSession) return null;
    const checkout = await createCheckout({
      type,
      email,
      gameId: activeSession.gameId,
      chatSessionId: activeSession.id,
    });

    let token: string;
    if (checkout.checkoutUrl === "__free__") {
      token = checkout.accessToken || "";
    } else if (checkout.checkoutUrl === "__mock__") {
      token = await mockComplete(checkout.sessionId);
    } else {
      const popup = window.open(checkout.checkoutUrl, "lemonsqueezy", "width=460,height=720,left=200,top=100");
      if (!popup) {
        window.localStorage.setItem(`${CHAT_SESSION_RESTORE_PREFIX}${activeSession.gameId}`, activeSession.id);
        window.location.href = checkout.checkoutUrl;
        return null;
      }
      token = (await waitForCheckout(checkout.sessionId)).accessToken || "";
      try { popup.close(); } catch {}
    }

    if (!token) {
      throw new Error("Checkout could not be completed.");
    }

    window.localStorage.setItem(`${CHAT_SESSION_RESTORE_PREFIX}${activeSession.gameId}`, activeSession.id);
    window.localStorage.setItem(`${CHAT_TOKEN_PREFIX}${activeSession.id}`, token);
    setChatToken(token);
    await refreshChatSession(activeSession.id);
    return token;
  }

  function getStoredChatToken(sessionId: string): string | null {
    try {
      return window.localStorage.getItem(`${CHAT_TOKEN_PREFIX}${sessionId}`) || null;
    } catch {
      return null;
    }
  }

  async function unlockChatRoom(emailOverride?: string) {
    if (!chatSession) {
      throw new Error("Chat session unavailable.");
    }

    setChatError("");

    const normalizedEmail = (emailOverride ?? leadEmail).trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
      throw new Error(
        promoActive
          ? "Enter a valid email to unlock free launch access."
          : "Drop a valid email to unlock this matchup room.",
      );
    }

    let activeSession = chatSession;
    let questionsRemaining = chatQuestionsRemaining;
    const resolved = await resolveSessionByEmail(normalizedEmail);
    if (resolved) {
      activeSession = resolved.session;
      questionsRemaining = resolved.questionsRemaining;
    }

    const existingToken = getStoredChatToken(activeSession.id) || chatToken;

    if (activeSession.isPaid && questionsRemaining <= 0) {
      return {
        session: activeSession,
        token: existingToken,
      };
    }

    if (activeSession.isPaid && questionsRemaining > 0 && existingToken) {
      setChatToken(existingToken);
      return {
        session: activeSession,
        token: existingToken,
      };
    }

    const token = await openCheckoutAndWait("match_chat", normalizedEmail, activeSession);
    if (!token) {
      return null;
    }

    toast.success(promoActive ? "AI room opened for free." : "Chat unlocked! Ask your questions.");
    return {
      session: activeSession,
      token,
    };
  }

  async function purchaseExtra() {
    if (!chatSession) {
      setChatError("Chat session unavailable.");
      return;
    }
    setChatError("");
    try {
      const token = await openCheckoutAndWait("extra_questions", undefined, chatSession);
      if (!token) {
        return;
      }
      toast.success("+3 questions unlocked!");
      inputRef.current?.focus();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not unlock more questions.");
    }
  }

  async function sendChatMessage() {
    const messageToSend = chatInput.trim();
    if (!chatSession || !messageToSend) return;
    if (chatQuestionsRemaining <= 0 && chatSession.isPaid) { setChatError("Question limit reached."); return; }
    if (!chatSession.isPaid) {
      setPendingQuestion(messageToSend);
      if (!validateEmail(leadEmail.trim().toLowerCase())) {
        setShowEmailCapture(true);
        setChatError("");
        return;
      }

      await continuePendingQuestion(messageToSend);
      return;
    }
    if (!chatToken) { setChatError("Payment required."); return; }

    await postChatMessage(messageToSend, chatSession, chatToken);
  }

  async function postChatMessage(message: string, sessionOverride?: ChatSessionState | null, tokenOverride?: string | null) {
    const activeSession = sessionOverride ?? chatSession;
    const activeToken = tokenOverride ?? chatToken;
    if (!activeSession || !activeToken) {
      setChatError("Payment required.");
      return;
    }

    setIsChatBusy(true);
    setChatError("");
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          sessionId: activeSession.id,
          message,
          email: leadEmail.trim().toLowerCase() || undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setChatError(data.message || "Payment required.");
        await refreshChatSession(activeSession.id);
        return;
      }
      if (!res.ok) throw new Error(data.message || "Chat request failed.");
      setChatMessages(data.messages as ChatMessage[]);
      onMessagesChange(data.messages as ChatMessage[]);
      setChatQuestionsRemaining(data.questionsRemaining ?? 0);
      setChatInput("");
      setPendingQuestion("");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Network error.");
    } finally {
      setIsChatBusy(false);
    }
  }

  async function continuePendingQuestion(questionOverride?: string) {
    const messageToSend = (questionOverride || pendingQuestion || chatInput).trim();
    if (!messageToSend) {
      setChatError("Ask a question first.");
      return;
    }

    setIsUnlockingQuestion(true);
    try {
      const normalizedEmail = leadEmail.trim().toLowerCase();
      const unlocked = await unlockChatRoom(normalizedEmail);
      if (!unlocked?.token) {
        return;
      }

      setShowEmailCapture(false);
      await postChatMessage(messageToSend, unlocked.session, unlocked.token);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not continue with this email.");
    } finally {
      setIsUnlockingQuestion(false);
    }
  }

  const isPaid = chatSession?.isPaid ?? false;
  const questionLimit = chatSession?.questionLimit ?? 0;
  const canSend = !isInitializing && !isChatBusy && (!isPaid || chatQuestionsRemaining > 0);

  return (
    <motion.div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4"
      initial={{ backgroundColor: "rgba(0,0,0,0)" }}
      animate={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      exit={{ backgroundColor: "rgba(0,0,0,0)" }}
      transition={{ duration: 0.25 }}
      style={{ backdropFilter: "blur(10px)" }}
    >
      <motion.div
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden border border-[color:var(--line-strong)] bg-[color:var(--panel-strong)] shadow-[0_32px_80px_rgba(0,0,0,0.5)] md:h-auto md:max-h-[88vh] md:max-w-3xl md:rounded-[2rem]"
        initial={{ opacity: 0, y: 60, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="relative flex-shrink-0 border-b border-[color:var(--line)] px-4 py-4 md:px-5"
          style={{
            background: "linear-gradient(140deg, color-mix(in oklab, var(--panel-strong) 80%, transparent), color-mix(in oklab, var(--accent-soft) 18%, transparent))",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--silver-gray)]">AI matchup analysis</p>
                {game.status === "live" && <span className="live-dot" />}
              </div>
              <div className="heading flex items-center gap-2 text-lg font-semibold text-[color:var(--pure-white)] md:text-xl">
                {game.awayTeam}
                <span className="text-xs text-[color:var(--silver-gray)] md:text-sm">@</span>
                {game.homeTeam}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[color:var(--silver-gray)] md:mt-2 md:text-[11px]">
                <span>{game.statusDetail}</span>
                <span className="text-[color:var(--line-strong)]">•</span>
                <span>{formatEstTime(game.gameTimeEST)} ET</span>
                <span className="hidden text-[color:var(--line-strong)] md:inline">•</span>
                <span className="hidden md:inline">{game.awayTeam} {moneyline(game.awayMoneyline)}</span>
                <span className="hidden md:inline">{game.homeTeam} {moneyline(game.homeMoneyline)}</span>
              </div>
            </div>
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="ml-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--line)] text-[var(--muted)] transition hover:border-[color:var(--line-strong)] hover:bg-white/[0.04] hover:text-white md:h-9 md:w-9"
              aria-label="Close chat"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>
          </div>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3 md:space-y-3 md:px-4 md:py-4">
          {isInitializing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <motion.div
                className="h-8 w-8 rounded-full border-2 border-[#00c853]/30 border-t-[#00c853]"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span className="mt-3 text-sm text-[var(--muted)]">Opening AI analysis...</span>
            </div>
          ) : chatMessages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-[1.25rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-4 py-6 text-center md:rounded-[1.5rem] md:px-6 md:py-10"
            >
              <motion.div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-xl"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <svg className="h-6 w-6 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </motion.div>
              <p className="mb-1 text-sm font-medium text-white">Ready to analyze this matchup</p>
              <p className="max-w-sm text-[11px] leading-5 text-[color:var(--silver-gray)]">
                {isPaid
                  ? "Ask about this specific matchup. Each game keeps its own running question count."
                  : promoActive
                    ? "Launch week is live. Ask 3 questions about this specific matchup free with your email."
                    : "Ask 3 questions about this specific matchup. Each game is a separate $2 session."}
              </p>
            </motion.div>
          ) : null}

          {!isInitializing && !hasMatchMarkdown ? (
            <div className="chat-context-note">
              Our engine has not published a game-specific markdown read for this matchup yet. The AI is using live board data only.
            </div>
          ) : null}

          {chatMessages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, delay: index === chatMessages.length - 1 ? 0.05 : 0 }}
              className={`rounded-[1.15rem] p-3 md:rounded-[1.35rem] md:p-4 ${
                message.role === "user"
                  ? "ml-auto max-w-[85%] break-words border border-[color:var(--money-green-line)] bg-[color:var(--money-green-soft)]"
                  : "break-words border border-[color:var(--line)] bg-[color:var(--panel-soft)]"
              }`}
            >
              <div className="mono mb-2 flex items-center gap-1.5 text-[11px]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${message.role === "user" ? "bg-[color:var(--money-green)]" : "bg-[color:var(--gold)]"}`} />
                <span className="text-[color:var(--silver-gray)]">{message.role === "user" ? "You" : "LOCKIN AI"}</span>
              </div>
              {message.role === "assistant" ? (
                <MarkdownContent content={message.content} className="text-sm" />
              ) : (
                <div className="text-sm leading-relaxed text-[#f5f5f3] whitespace-pre-wrap">{message.content}</div>
              )}
            </motion.div>
          ))}

          {isChatBusy && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] p-4"
            >
              <div className="mono mb-2 flex items-center gap-1.5 text-[11px]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--gold)]" />
                <span className="text-[color:var(--silver-gray)]">LOCKIN AI</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[color:var(--silver-gray)]">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--money-green)]"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
                Building the matchup read...
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="flex-shrink-0 border-t border-[color:var(--line)] bg-[color:var(--panel)]/95 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:px-4 md:py-3">
          {chatError && (
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-2 rounded-[1rem] border border-[color:var(--signal-red-line)] bg-[color:var(--signal-red-soft)] px-3 py-2 text-xs text-[var(--signal-red)]"
            >
              {chatError}
            </motion.p>
          )}

          <div className="mb-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--silver-gray)] md:mb-3">
            <span className={`mono ${isPaid ? "text-[color:var(--money-green)]" : ""}`}>
              {isPaid ? "Active Room" : promoActive ? "Free This Week" : "AI Analysis"}
            </span>
            <span className="mono">
              {questionLimit > 0
                ? `${chatQuestionsRemaining}/${questionLimit} left`
                : "3 questions per session"}
            </span>
          </div>

          {isPaid && chatQuestionsRemaining <= 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="chat-paywall"
            >
              <div className="chat-paywall__copy">
                <div className="chat-paywall__eyebrow">Question Limit Reached</div>
                <p className="chat-paywall__title">Need more depth?</p>
                <p className="chat-paywall__body">Add 3 more questions for this game for $1 and keep this room active.</p>
              </div>
              <motion.button
                type="button"
                onClick={purchaseExtra}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="secondary-button w-full justify-center"
              >
                +3 more questions for this game — $1
              </motion.button>
            </motion.div>
          )}

          {showEmailCapture ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="chat-paywall"
            >
              <div className="chat-paywall__copy">
                <div className="chat-paywall__eyebrow">{promoActive ? "Launch Access" : "Continue With Email"}</div>
                <p className="chat-paywall__title">Drop your email to unlock AI analysis.</p>
                <p className="chat-paywall__body">
                  {promoActive
                    ? "Free during launch week. No account needed."
                    : "No account needed. Your first question will send automatically after checkout."}
                </p>
              </div>

              <div className="space-y-2">
                <label className="input-label" htmlFor="chat-lead-email">Email</label>
                <input
                  id="chat-lead-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={leadEmail}
                  onChange={(event) => setLeadEmail(event.target.value)}
                  placeholder="you@lockinmail.com"
                  className="input-field"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void continuePendingQuestion()}
                  disabled={isUnlockingQuestion}
                  className="primary-button w-full justify-center disabled:opacity-50"
                >
                  {isUnlockingQuestion ? "Continuing..." : "Continue"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailCapture(false)}
                  className="secondary-button w-full justify-center"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          ) : null}

          <div className="space-y-2">
            <label className="input-label" htmlFor="chat-question">Ask anything about this matchup</label>
            <div className="flex gap-2">
              <textarea
                id="chat-question"
                ref={inputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask anything about this matchup..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
                }}
                disabled={isInitializing || (isPaid && chatQuestionsRemaining <= 0)}
                rows={1}
                className="input-field min-h-[44px] flex-1 resize-none disabled:opacity-40"
              />
              <motion.button
                type="button"
                onClick={sendChatMessage}
                disabled={!canSend || !chatInput.trim()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="primary-button shrink-0"
                aria-label="Send message"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Ask AI
              </motion.button>
            </div>
            {!canSend && (
              <p className="text-[11px] text-[color:var(--silver-gray)]">
                {isPaid
                  ? "Buy more questions for this matchup to keep the room active."
                  : promoActive
                    ? "Type your first question and hit Send. We will ask for email on the next step."
                    : "Type your first question and hit Send. Email and checkout happen after that."}
              </p>
            )}
          </div>

          {isPaid && chatMessages.length > 0 && (
            <motion.button
              type="button"
              onClick={onShareRequest}
              disabled={isShareBusy}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="secondary-button mt-2.5 w-full justify-center"
              >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {isShareBusy ? "Generating..." : "Export share card"}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
