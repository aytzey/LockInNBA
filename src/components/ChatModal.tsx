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
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) {
      onClose();
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
    if (!validateEmail(chatEmail)) {
      setChatError("Enter a valid email address.");
      return;
    }
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
    if (!chatSession || !chatEmail) {
      setChatError("Enter your email and unlock first.");
      return;
    }
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
    if (!chatSession) return;
    if (!chatInput.trim()) return;
    if (chatQuestionsRemaining <= 0) {
      setChatError("Question limit reached. Purchase more questions.");
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm md:items-center md:p-4"
    >
      <div className="flex max-h-[95vh] w-full flex-col rounded-t-xl border border-[#2a3852] bg-[#0a0e1a] md:max-h-[85vh] md:max-w-2xl md:rounded-xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-[#2a3852] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="heading flex items-center gap-2 text-lg text-white">
                {game.awayTeam} @ {game.homeTeam}
                {game.status === "live" && <span className="live-dot" />}
              </div>
              <div className="mono text-xs text-[#8b92a5]">
                {formatEstTime(game.gameTimeEST)} EST &middot; {game.awayTeam} {moneyline(game.awayMoneyline)} / {game.homeTeam} {moneyline(game.homeMoneyline)}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-3 rounded border border-[#8b92a5]/40 px-3 py-1.5 text-sm text-[#8b92a5] transition hover:border-white/40 hover:text-white"
              aria-label="Close chat"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {isInitializing ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#00c853] border-t-transparent" />
              <span className="ml-2 text-sm text-[#8b92a5]">Opening chat session...</span>
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="rounded-lg border border-[#2a3852] bg-[#101a2c] p-4 text-center">
              <div className="mb-2 text-2xl">🏀</div>
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
              className={`rounded-lg p-3 ${
                message.role === "user"
                  ? "ml-auto max-w-[85%] border border-[#00c853]/20 bg-[#00c853]/10 text-[#f5f5f3]"
                  : "border border-[#2a3852] bg-[#101a2c] text-[#f5f5f3]"
              }`}
            >
              <div className="mono mb-1.5 flex items-center gap-1.5 text-[11px] opacity-70">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${message.role === "user" ? "bg-[#00c853]" : "bg-[#ffd700]"}`} />
                {message.role === "user" ? "You" : "LOCKIN AI"}
              </div>
              {message.role === "assistant" ? (
                <MarkdownContent content={message.content} className="text-sm" />
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
              )}
            </div>
          ))}

          {isChatBusy && (
            <div className="rounded-lg border border-[#2a3852] bg-[#101a2c] p-3">
              <div className="mono mb-1.5 flex items-center gap-1.5 text-[11px] opacity-70">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ffd700]" />
                LOCKIN AI
              </div>
              <div className="flex items-center gap-2 text-sm text-[#8b92a5]">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </span>
                Analyzing matchup data
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-[#2a3852] px-4 py-3">
          {chatError && (
            <p className="mb-2 rounded bg-[#ff3b3b]/10 px-3 py-1.5 text-xs text-[#ff3b3b]">{chatError}</p>
          )}

          <div className="mb-2 flex items-center justify-between text-xs text-[#8b92a5]">
            <span>
              {chatQuestionsRemaining > 0
                ? `${chatQuestionsRemaining} question${chatQuestionsRemaining === 1 ? "" : "s"} remaining`
                : "No questions remaining"}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${isPaid ? "bg-[#00c853]/15 text-[#00c853]" : "bg-[#ff6b35]/15 text-[#ff6b35]"}`}>
              {isPaid ? "Active" : "Locked"}
            </span>
          </div>

          {showPaywall && (
            <div className="mb-3 space-y-2">
              <input
                value={chatEmail}
                onChange={(e) => setChatEmail(e.target.value)}
                className="w-full rounded border border-[#00c853]/30 bg-[#0f1524] p-2 text-sm text-white outline-none transition focus:border-[#00c853]"
                placeholder="you@email.com"
                type="email"
              />
              {!isPaid ? (
                <button
                  type="button"
                  onClick={ensureChatPaid}
                  className="w-full rounded-lg bg-[#00c853] px-3 py-2.5 text-sm font-semibold text-[#0a0e1a] transition hover:bg-[#00ff87]"
                >
                  Discuss this game with AI — $2
                </button>
              ) : (
                <button
                  type="button"
                  onClick={purchaseExtra}
                  className="w-full rounded-lg bg-[#ff6b35] px-3 py-2.5 text-sm font-semibold text-black transition hover:bg-[#ff8a56]"
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
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              disabled={!canSend}
              className="flex-1 rounded-lg border border-[#2a3852] bg-[#0f1524] px-3 py-2 text-sm text-white outline-none transition focus:border-[#00c853] disabled:opacity-50"
              placeholder={canSend ? "Ask about this matchup..." : "Unlock chat to ask questions"}
            />
            <button
              type="button"
              onClick={sendChatMessage}
              disabled={!canSend || !chatInput.trim()}
              className="rounded-lg bg-[#00c853] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#00ff87] disabled:opacity-40"
            >
              Send
            </button>
          </div>

          {isPaid && chatMessages.length > 0 && (
            <button
              type="button"
              onClick={onShareRequest}
              disabled={isShareBusy}
              className="mt-2 w-full rounded-lg border border-[#00ff87]/30 px-3 py-2 text-xs text-[#00ff87] transition hover:bg-[#00ff87]/10"
            >
              {isShareBusy ? "Generating..." : "Share your edge"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
