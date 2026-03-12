"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, ChatMessage, ChatSessionState } from "./types";
import { formatEstTime, moneyline, validateEmail, CHAT_TOKEN_PREFIX } from "./utils";
import { createCheckout, finalizeCheckout } from "./api";
import MarkdownContent from "./MarkdownContent";

interface ChatModalProps {
  game: Game;
  onClose: () => void;
  onShareRequest: () => void;
  isShareBusy: boolean;
}

export default function ChatModal({ game, onClose, onShareRequest, isShareBusy }: ChatModalProps) {
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
  }, [game.id]);

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
    if (Array.isArray(data.messages)) setChatMessages(data.messages as ChatMessage[]);
  }

  async function ensureChatPaid() {
    if (!chatSession || !chatEmail) return;
    if (!validateEmail(chatEmail)) { setChatError("Enter a valid email address."); return; }
    if (chatSession.isPaid && chatQuestionsRemaining > 0) return;
    setChatError("");
    try {
      const checkout = await createCheckout("match_chat", chatEmail, chatSession.gameId, chatSession.id);
      const token = await finalizeCheckout(checkout.sessionId);
      window.localStorage.setItem(`${CHAT_TOKEN_PREFIX}${chatSession.id}`, token);
      setChatToken(token);
      await refreshChatSession(chatSession.id);
      inputRef.current?.focus();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Payment failed");
    }
  }

  async function purchaseExtra() {
    if (!chatSession || !chatEmail) { setChatError("Enter your email and unlock first."); return; }
    setChatError("");
    try {
      const checkout = await createCheckout("extra_questions", chatEmail, chatSession.gameId, chatSession.id);
      const token = await finalizeCheckout(checkout.sessionId);
      window.localStorage.setItem(`${CHAT_TOKEN_PREFIX}${chatSession.id}`, token);
      setChatToken(token);
      await refreshChatSession(chatSession.id);
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
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 p-0 backdrop-blur-sm md:items-center md:p-4"
    >
      <div className="slide-up flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#2a3852]/80 bg-gradient-to-b from-[#0d1422] to-[#0a0e1a] md:max-h-[85vh] md:max-w-2xl md:rounded-2xl">
        {/* Header */}
        <div className="relative flex-shrink-0 border-b border-[#2a3852]/60 bg-gradient-to-r from-[#0f1524] to-[#111d30] px-4 py-4">
          <div className="absolute bottom-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-[#00c853]/20 to-transparent" />
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="heading flex items-center gap-2 text-lg font-semibold text-white">
                {game.awayTeam}
                <span className="text-sm text-[#8b92a5]/60">vs</span>
                {game.homeTeam}
                {game.status === "live" && <span className="live-dot" />}
              </div>
              <div className="mono mt-1 flex items-center gap-2 text-xs text-[#8b92a5]">
                <span>{formatEstTime(game.gameTimeEST)} EST</span>
                <span className="text-[#2a3852]">|</span>
                <span>{game.awayTeam} {moneyline(game.awayMoneyline)}</span>
                <span className="text-[#2a3852]">/</span>
                <span>{game.homeTeam} {moneyline(game.homeMoneyline)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-3 flex h-8 w-8 items-center justify-center rounded-lg border border-[#2a3852] text-[#8b92a5] transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
              aria-label="Close chat"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {isInitializing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00c853]/30 border-t-[#00c853]" />
              <span className="mt-3 text-sm text-[#8b92a5]">Opening chat session...</span>
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a3852]/40 bg-gradient-to-b from-[#111d30] to-transparent px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#00c853]/10 text-xl">
                <svg className="h-6 w-6 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="mb-1 text-sm font-medium text-white">Ready to analyze this matchup</p>
              <p className="text-xs text-[#8b92a5]">
                {isPaid
                  ? "Type your question below to get AI-powered analysis."
                  : "Unlock chat for $2 to get 3 AI-powered matchup questions."}
              </p>
            </div>
          ) : null}

          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`fade-in rounded-xl p-4 ${
                message.role === "user"
                  ? "ml-auto max-w-[85%] border border-[#00c853]/15 bg-[#00c853]/[0.06]"
                  : "border border-[#2a3852]/40 bg-gradient-to-br from-[#111d30] to-[#0d1422]"
              }`}
            >
              <div className="mono mb-2 flex items-center gap-1.5 text-[11px]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${message.role === "user" ? "bg-[#00c853]" : "bg-[#ffd700]"}`} />
                <span className="text-[#8b92a5]">{message.role === "user" ? "You" : "LOCKIN AI"}</span>
              </div>
              {message.role === "assistant" ? (
                <MarkdownContent content={message.content} className="text-sm" />
              ) : (
                <div className="text-sm leading-relaxed text-[#f5f5f3] whitespace-pre-wrap">{message.content}</div>
              )}
            </div>
          ))}

          {isChatBusy && (
            <div className="fade-in rounded-xl border border-[#2a3852]/40 bg-gradient-to-br from-[#111d30] to-[#0d1422] p-4">
              <div className="mono mb-2 flex items-center gap-1.5 text-[11px]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ffd700]" />
                <span className="text-[#8b92a5]">LOCKIN AI</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#8b92a5]">
                <div className="flex gap-0.5">
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#00c853]" style={{ animationDelay: "0ms" }} />
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#00c853]" style={{ animationDelay: "150ms" }} />
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#00c853]" style={{ animationDelay: "300ms" }} />
                </div>
                Analyzing matchup data...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-[#2a3852]/60 bg-[#0a0e1a]/80 px-4 py-3">
          {chatError && (
            <p className="mb-2 rounded-lg border border-[#ff3b3b]/20 bg-[#ff3b3b]/[0.06] px-3 py-2 text-xs text-[#ff3b3b]">{chatError}</p>
          )}

          <div className="mb-2.5 flex items-center justify-between text-xs">
            <span className="text-[#8b92a5]">
              {chatQuestionsRemaining > 0
                ? `${chatQuestionsRemaining} question${chatQuestionsRemaining === 1 ? "" : "s"} remaining`
                : "No questions remaining"}
            </span>
            <span className={`mono rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isPaid ? "border border-[#00c853]/20 bg-[#00c853]/[0.08] text-[#00c853]" : "border border-[#ff6b35]/20 bg-[#ff6b35]/[0.08] text-[#ff6b35]"
            }`}>
              {isPaid ? "Active" : "Locked"}
            </span>
          </div>

          {showPaywall && (
            <div className="mb-3 space-y-2.5">
              <input
                value={chatEmail}
                onChange={(e) => setChatEmail(e.target.value)}
                className="input-field w-full"
                placeholder="you@email.com"
                type="email"
              />
              {!isPaid ? (
                <button
                  type="button"
                  onClick={ensureChatPaid}
                  className="btn-glow w-full rounded-xl bg-gradient-to-r from-[#00c853] to-[#00b848] px-3 py-2.5 text-sm font-semibold text-[#0a0e1a] transition hover:from-[#00ff87] hover:to-[#00c853]"
                >
                  Discuss this game with AI — $2
                </button>
              ) : (
                <button
                  type="button"
                  onClick={purchaseExtra}
                  className="w-full rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e55a25] px-3 py-2.5 text-sm font-semibold text-black transition hover:from-[#ff8a56] hover:to-[#ff6b35]"
                >
                  +3 more questions — $1
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
              }}
              disabled={!canSend}
              className="input-field flex-1 disabled:opacity-40"
              placeholder={canSend ? "Ask about this matchup..." : "Unlock chat to ask questions"}
            />
            <button
              type="button"
              onClick={sendChatMessage}
              disabled={!canSend || !chatInput.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00c853] to-[#00b848] px-4 py-2 text-sm font-semibold text-black transition hover:from-[#00ff87] hover:to-[#00c853] disabled:opacity-30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send
            </button>
          </div>

          {isPaid && chatMessages.length > 0 && (
            <button
              type="button"
              onClick={onShareRequest}
              disabled={isShareBusy}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#00ff87]/20 px-3 py-2 text-xs text-[#00ff87] transition hover:bg-[#00ff87]/[0.05]"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {isShareBusy ? "Generating..." : "Share your edge"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
