"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import type { Game, ChatMessage, ChatSessionState } from "./types";
import { formatEstTime, moneyline, validateEmail, CHAT_TOKEN_PREFIX } from "./utils";
import { createCheckout, waitForCheckout, mockComplete } from "./api";
import MarkdownContent from "./MarkdownContent";

interface ChatModalProps {
  game: Game;
  onClose: () => void;
  onShareRequest: () => void;
  isShareBusy: boolean;
  onMessagesChange: (messages: ChatMessage[]) => void;
}

export default function ChatModal({ game, onClose, onShareRequest, isShareBusy, onMessagesChange }: ChatModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [chatSession, setChatSession] = useState<ChatSessionState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatToken, setChatToken] = useState<string | null>(null);
  const [chatQuestionsRemaining, setChatQuestionsRemaining] = useState(0);
  const [chatEmail, setChatEmail] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    async function initSession() {
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
        onMessagesChange(data.messages ?? []);
        setChatEmail(session.email || "");
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
    }
    if (Array.isArray(data.messages)) {
      const nextMessages = data.messages as ChatMessage[];
      setChatMessages(nextMessages);
      onMessagesChange(nextMessages);
    }
  }

  async function openCheckoutAndWait(type: "match_chat" | "extra_questions") {
    if (!chatSession || !chatEmail) return;
    const checkout = await createCheckout(type, chatEmail, chatSession.gameId, chatSession.id);

    let token: string;
    if (checkout.checkoutUrl === "__mock__") {
      token = await mockComplete(checkout.sessionId);
    } else {
      const popup = window.open(checkout.checkoutUrl, "lemonsqueezy", "width=460,height=720,left=200,top=100");
      if (!popup) {
        window.location.href = checkout.checkoutUrl;
        return;
      }
      token = await waitForCheckout(checkout.sessionId);
      try { popup.close(); } catch {}
    }

    window.localStorage.setItem(`${CHAT_TOKEN_PREFIX}${chatSession.id}`, token);
    setChatToken(token);
    await refreshChatSession(chatSession.id);
    return token;
  }

  async function ensureChatPaid() {
    if (!chatSession || !chatEmail) return;
    if (!validateEmail(chatEmail)) { setChatError("Enter a valid email address."); return; }
    if (chatSession.isPaid && chatQuestionsRemaining > 0) return;
    setChatError("");
    try {
      await openCheckoutAndWait("match_chat");
      toast.success("Chat unlocked! Ask your questions.");
      inputRef.current?.focus();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Payment failed");
    }
  }

  async function purchaseExtra() {
    if (!chatSession || !chatEmail) { setChatError("Enter your email and unlock first."); return; }
    setChatError("");
    try {
      await openCheckoutAndWait("extra_questions");
      toast.success("+3 questions unlocked!");
      inputRef.current?.focus();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not unlock more questions.");
    }
  }

  async function sendChatMessage() {
    if (!chatSession || !chatInput.trim()) return;
    if (chatQuestionsRemaining <= 0) { setChatError("Question limit reached."); return; }
    if (!chatToken) { setChatError("Payment required."); return; }

    setIsChatBusy(true);
    setChatError("");
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${chatToken}`,
        },
        body: JSON.stringify({ sessionId: chatSession.id, message: chatInput.trim(), email: chatEmail }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setChatError(data.message || "Payment required.");
        await refreshChatSession(chatSession.id);
        return;
      }
      if (!res.ok) throw new Error(data.message || "Chat request failed.");
      setChatMessages(data.messages as ChatMessage[]);
      onMessagesChange(data.messages as ChatMessage[]);
      setChatQuestionsRemaining(data.questionsRemaining ?? 0);
      setChatInput("");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Network error.");
    } finally {
      setIsChatBusy(false);
    }
  }

  const isPaid = chatSession?.isPaid ?? false;
  const canSend = isPaid && chatQuestionsRemaining > 0 && !isChatBusy;
  const showPaywall = !isPaid || chatQuestionsRemaining <= 0;

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
        className="flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-[color:var(--line-strong)] bg-[color:var(--panel-strong)] md:max-h-[88vh] md:max-w-3xl md:rounded-[2rem]"
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
              <div className="mb-1 flex items-center gap-2">
                <p className="section-kicker section-kicker--muted">Matchup chat</p>
                {game.status === "live" && <span className="live-dot" />}
              </div>
              <div className="heading flex items-center gap-2 text-xl font-semibold text-white">
                {game.awayTeam}
                <span className="text-sm text-[var(--muted)]/60">@</span>
                {game.homeTeam}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                <span>{game.statusDetail}</span>
                <span className="text-[color:var(--line-strong)]">•</span>
                <span>{formatEstTime(game.gameTimeEST)} EST</span>
                <span className="text-[color:var(--line-strong)]">•</span>
                <span>{game.awayTeam} {moneyline(game.awayMoneyline)}</span>
                <span>{game.homeTeam} {moneyline(game.homeMoneyline)}</span>
              </div>
            </div>
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="ml-3 flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--line)] text-[var(--muted)] transition hover:border-[color:var(--line-strong)] hover:bg-white/[0.04] hover:text-white"
              aria-label="Close chat"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {isInitializing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <motion.div
                className="h-8 w-8 rounded-full border-2 border-[#00c853]/30 border-t-[#00c853]"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span className="mt-3 text-sm text-[var(--muted)]">Opening matchup room...</span>
            </div>
          ) : chatMessages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-6 py-10 text-center"
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
              <p className="max-w-sm text-xs leading-5 text-[var(--muted)]">
                {isPaid
                  ? "Ask for market read, team shape, risk framing or game-script pressure."
                  : "Unlock this room for $2 to ask three focused matchup questions."}
              </p>
            </motion.div>
          ) : null}

          {chatMessages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, delay: index === chatMessages.length - 1 ? 0.05 : 0 }}
              className={`rounded-[1.35rem] p-4 ${
                message.role === "user"
                  ? "ml-auto max-w-[85%] border border-[color:var(--accent-line)] bg-[color:var(--accent-soft)]"
                  : "border border-[color:var(--line)] bg-[color:var(--panel-soft)]"
              }`}
            >
              <div className="mono mb-2 flex items-center gap-1.5 text-[11px]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${message.role === "user" ? "bg-[color:var(--accent)]" : "bg-[color:var(--amber)]"}`} />
                <span className="text-[var(--muted)]">{message.role === "user" ? "You" : "LOCKIN AI"}</span>
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
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--amber)]" />
                <span className="text-[var(--muted)]">LOCKIN AI</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]"
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

        <div className="flex-shrink-0 border-t border-[color:var(--line)] bg-[color:var(--panel)]/95 px-4 py-3">
          {chatError && (
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-2 rounded-[1rem] border border-[color:var(--signal-red-line)] bg-[color:var(--signal-red-soft)] px-3 py-2 text-xs text-[var(--signal-red)]"
            >
              {chatError}
            </motion.p>
          )}

          <div className="mb-2.5 flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">
              {chatQuestionsRemaining > 0
                ? `${chatQuestionsRemaining} question${chatQuestionsRemaining === 1 ? "" : "s"} remaining`
                : "No questions remaining"}
            </span>
            <span className={`mono rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isPaid ? "border border-[color:var(--accent-line)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]" : "border border-[color:var(--amber-line)] bg-[color:var(--amber-soft)] text-[color:var(--amber)]"
            }`}>
              {isPaid ? "Active" : "Locked"}
            </span>
          </div>

          {showPaywall && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 space-y-2.5"
            >
              <div className="space-y-2">
                <label className="input-label" htmlFor="chat-email">Email for unlock and restore</label>
                <input
                  id="chat-email"
                  value={chatEmail}
                  onChange={(e) => setChatEmail(e.target.value)}
                  className="input-field w-full"
                  type="email"
                  autoComplete="email"
                />
              </div>
              {!isPaid ? (
                <motion.button
                  type="button"
                  onClick={ensureChatPaid}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="primary-button w-full justify-center"
                >
                  Unlock this matchup room
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={purchaseExtra}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="secondary-button w-full justify-center"
                >
                  Add 3 more questions
                </motion.button>
              )}
            </motion.div>
          )}

          <div className="space-y-2">
            <label className="input-label" htmlFor="chat-question">Your question</label>
            <div className="flex gap-2">
              <input
                id="chat-question"
                ref={inputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
                }}
                disabled={!canSend}
                className="input-field flex-1 disabled:opacity-40"
              />
              <motion.button
                type="button"
                onClick={sendChatMessage}
                disabled={!canSend || !chatInput.trim()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="primary-button shrink-0"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send
              </motion.button>
            </div>
            {!canSend && (
              <p className="text-[11px] text-[var(--muted)]">
                {isPaid ? "Buy more questions to keep the room active." : "Unlock the room to start asking."}
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
              {isShareBusy ? "Generating card" : "Export share card"}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
