"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MarkdownContent from "@/components/MarkdownContent";
import SocialProofBanner from "@/components/SocialProofBanner";

type AdminPrediction = {
  id: string;
  date: string;
  teaserText: string;
  markdownContent: string;
  isNoEdgeDay: boolean;
  source: "auto" | "admin";
  createdAt: string;
};

type SystemPrompt = {
  id: string;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: string;
};

type SiteCopy = {
  dailyCtaText: string;
  dailyPriceSubtext: string;
  noEdgeMessage: string;
  headerRightText: string;
  metaDescription: string;
  footerDisclaimer: string;
};

type PromoBanner = {
  isActive: boolean;
  bannerText: string;
  endDatetime: string;
  updatedAt: string;
};

type AdminGame = {
  id: string;
  awayTeam: string;
  homeTeam: string;
  gameTimeEST: string;
  status: "upcoming" | "live" | "final";
};

type MatchMarkdown = {
  id: string;
  gameId: string;
  date: string;
  markdownContent: string;
  createdAt: string;
  updatedAt: string;
};

const ADMIN_TOKEN_KEY = "lockin_admin_token";
const DEFAULT_SITE_COPY: SiteCopy = {
  dailyCtaText: "Unlock Tonight's Edge",
  dailyPriceSubtext: "$5 one-time pass",
  noEdgeMessage: "We passed on 90% of this week's games. We only bet when the math screams.",
  headerRightText: "",
  metaDescription: "LOCKIN is a premium AI sports analytics platform delivering nightly NBA moneyline analysis and per-game statistical insights.",
  footerDisclaimer:
    "For entertainment purposes only. LOCKIN does not accept wagers or guarantee outcomes. If you or someone you know has a gambling problem, call 1-800-GAMBLER.",
};
const DEFAULT_PROMO_BANNER: PromoBanner = {
  isActive: false,
  bannerText: "LAUNCH WEEK: 100% FREE ACCESS — Unlock every pick & AI chat free for 7 days.",
  endDatetime: "",
  updatedAt: "",
};

function estDateInputValue(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

function toDateTimeLocalValue(value: string): string {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  const hours = `${parsed.getHours()}`.padStart(2, "0");
  const minutes = `${parsed.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function addAuthHeader(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function parseMessageInput(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatGameLabel(game: AdminGame): string {
  return `${game.awayTeam} @ ${game.homeTeam}`;
}

function formatGameTime(gameTimeEST: string): string {
  const parsed = new Date(gameTimeEST);
  if (Number.isNaN(parsed.getTime())) {
    return "TBD";
  }

  return parsed.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminSecurePage() {
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");

  const [predictions, setPredictions] = useState<AdminPrediction[]>([]);
  const [selectedPredictionId, setSelectedPredictionId] = useState("");
  const [predictionDate, setPredictionDate] = useState(estDateInputValue());
  const [teaserText, setTeaserText] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
  const [isNoEdgeDay, setIsNoEdgeDay] = useState(false);
  const [predictionMessage, setPredictionMessage] = useState("");
  const [predictionSaving, setPredictionSaving] = useState(false);

  const [matchMarkdownGames, setMatchMarkdownGames] = useState<AdminGame[]>([]);
  const [matchMarkdowns, setMatchMarkdowns] = useState<Record<string, string>>({});
  const [matchMarkdownLoading, setMatchMarkdownLoading] = useState(false);
  const [matchMarkdownSaving, setMatchMarkdownSaving] = useState(false);
  const [matchMarkdownMessage, setMatchMarkdownMessage] = useState("");

  const [socialProofText, setSocialProofText] = useState("");
  const [socialProofMessage, setSocialProofMessage] = useState("");

  const [siteCopy, setSiteCopy] = useState<SiteCopy>(DEFAULT_SITE_COPY);
  const [siteCopyMessage, setSiteCopyMessage] = useState("");

  const [promoBanner, setPromoBanner] = useState<PromoBanner>(DEFAULT_PROMO_BANNER);
  const [promoMessage, setPromoMessage] = useState("");

  const [activePrompt, setActivePrompt] = useState("");
  const [promptHistory, setPromptHistory] = useState<SystemPrompt[]>([]);
  const [promptText, setPromptText] = useState("");
  const [promptMessage, setPromptMessage] = useState("");

  const [activeTab, setActiveTab] = useState<"predictions" | "social" | "copy" | "promo" | "prompt">("predictions");

  const socialProofMessages = useMemo(() => parseMessageInput(socialProofText), [socialProofText]);

  const clearStoredAuth = useCallback(() => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
  }, []);

  const loadMatchMarkdowns = useCallback(async (tokenValue: string, dateValue: string) => {
    setMatchMarkdownLoading(true);
    setMatchMarkdownMessage("");

    try {
      const response = await fetch(`/api/admin/match-markdowns?date=${dateValue}`, {
        headers: addAuthHeader(tokenValue),
      });

      if (response.status === 401) {
        clearStoredAuth();
        setChecking(false);
        return;
      }

      const body = await response.json();
      if (!response.ok) {
        setMatchMarkdownMessage(body.message || "Could not load match markdowns.");
        return;
      }

      const nextGames = Array.isArray(body.games) ? (body.games as AdminGame[]) : [];
      const nextMarkdowns = Array.isArray(body.matchMarkdowns)
        ? (body.matchMarkdowns as MatchMarkdown[]).reduce<Record<string, string>>((acc, entry) => {
            acc[entry.gameId] = entry.markdownContent || "";
            return acc;
          }, {})
        : {};

      setMatchMarkdownGames(nextGames);
      setMatchMarkdowns(nextMarkdowns);
    } catch {
      setMatchMarkdownMessage("Could not load match markdowns.");
    } finally {
      setMatchMarkdownLoading(false);
    }
  }, [clearStoredAuth]);

  const bootstrapAdmin = useCallback(async (tokenValue: string | null) => {
    if (!tokenValue) {
      return;
    }

    try {
      const [predictionsResponse, proofResponse, promptResponse, siteCopyResponse, promoResponse] = await Promise.all([
        fetch("/api/admin/predictions", { headers: addAuthHeader(tokenValue) }),
        fetch("/api/admin/social-proof-banner", { headers: addAuthHeader(tokenValue) }),
        fetch("/api/admin/system-prompt", { headers: addAuthHeader(tokenValue) }),
        fetch("/api/admin/site-copy", { headers: addAuthHeader(tokenValue) }),
        fetch("/api/admin/promo-banner", { headers: addAuthHeader(tokenValue) }),
      ]);

      if ([predictionsResponse, proofResponse, promptResponse, siteCopyResponse, promoResponse].some((response) => response.status === 401)) {
        clearStoredAuth();
        setChecking(false);
        return;
      }

      const [predictionsBody, proofBody, promptBody, siteCopyBody, promoBody] = await Promise.all([
        predictionsResponse.json(),
        proofResponse.json(),
        promptResponse.json(),
        siteCopyResponse.json(),
        promoResponse.json(),
      ]);

      setPredictions(predictionsBody.predictions || []);
      setSocialProofText(
        Array.isArray(proofBody.messages) && proofBody.messages.length > 0
          ? proofBody.messages.join("\n")
          : proofBody.banner || "",
      );
      setActivePrompt(promptBody.active?.content || "");
      setPromptHistory(promptBody.history || []);
      setSiteCopy({
        dailyCtaText: siteCopyBody.siteCopy?.dailyCtaText || DEFAULT_SITE_COPY.dailyCtaText,
        dailyPriceSubtext: siteCopyBody.siteCopy?.dailyPriceSubtext || DEFAULT_SITE_COPY.dailyPriceSubtext,
        noEdgeMessage: siteCopyBody.siteCopy?.noEdgeMessage || DEFAULT_SITE_COPY.noEdgeMessage,
        headerRightText: siteCopyBody.siteCopy?.headerRightText || DEFAULT_SITE_COPY.headerRightText,
        metaDescription: siteCopyBody.siteCopy?.metaDescription || DEFAULT_SITE_COPY.metaDescription,
        footerDisclaimer: siteCopyBody.siteCopy?.footerDisclaimer || DEFAULT_SITE_COPY.footerDisclaimer,
      });
      setPromoBanner({
        isActive: promoBody.promoBanner?.isActive ?? DEFAULT_PROMO_BANNER.isActive,
        bannerText: promoBody.promoBanner?.bannerText || DEFAULT_PROMO_BANNER.bannerText,
        endDatetime: promoBody.promoBanner?.endDatetime || "",
        updatedAt: promoBody.promoBanner?.updatedAt || "",
      });
    } catch {
      setPredictionMessage("Failed to load admin data.");
    } finally {
      setChecking(false);
    }
  }, [clearStoredAuth]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      void bootstrapAdmin(savedToken).catch(() => setChecking(false));
      return;
    }

    setChecking(false);
  }, [bootstrapAdmin]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadMatchMarkdowns(token, predictionDate);
  }, [loadMatchMarkdowns, predictionDate, token]);

  function selectPrediction(prediction: AdminPrediction) {
    setSelectedPredictionId(prediction.id);
    setPredictionDate(prediction.date);
    setTeaserText(prediction.teaserText);
    setMarkdownContent(prediction.markdownContent);
    setIsNoEdgeDay(prediction.isNoEdgeDay);
    setPredictionMessage("");
  }

  function clearPredictionForm() {
    setSelectedPredictionId("");
    setPredictionDate(estDateInputValue());
    setTeaserText("");
    setMarkdownContent("");
    setIsNoEdgeDay(false);
    setPredictionMessage("");
  }

  async function handleLogin() {
    setLoginMessage("");
    if (!username || !password) {
      setLoginMessage("Username and password required.");
      return;
    }

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginMessage(data.message || "Invalid credentials.");
        return;
      }

      window.localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setToken(data.token);
      await bootstrapAdmin(data.token);
    } catch {
      setLoginMessage("Network error. Please try again.");
    }
  }

  async function savePrediction() {
    if (!token) return;

    setPredictionMessage("");
    if (!predictionDate || (!isNoEdgeDay && (!teaserText.trim() || !markdownContent.trim()))) {
      setPredictionMessage("Date is required. Hero teaser and markdown are required unless No Edge day is enabled.");
      return;
    }

    setPredictionSaving(true);
    try {
      const res = await fetch("/api/admin/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...addAuthHeader(token),
        },
        body: JSON.stringify({
          id: selectedPredictionId || undefined,
          date: predictionDate,
          teaserText,
          markdownContent,
          isNoEdgeDay,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPredictionMessage(data.message || "Save failed.");
        return;
      }

      setPredictionMessage("Prediction saved.");
      setSelectedPredictionId(data.prediction.id);
      await bootstrapAdmin(token);
      selectPrediction(data.prediction);
    } catch {
      setPredictionMessage("Save failed due to network error.");
    } finally {
      setPredictionSaving(false);
    }
  }

  async function deletePrediction(id: string) {
    if (!token) return;
    if (!confirm("Delete this prediction?")) return;

    setPredictionMessage("");
    try {
      const res = await fetch("/api/admin/predictions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...addAuthHeader(token),
        },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPredictionMessage(data.message || "Delete failed.");
        return;
      }

      if (selectedPredictionId === id) {
        clearPredictionForm();
      }

      setPredictionMessage("Prediction deleted.");
      await bootstrapAdmin(token);
    } catch {
      setPredictionMessage("Delete failed due to network error.");
    }
  }

  async function saveMatchMarkdownEntries() {
    if (!token) return;

    setMatchMarkdownSaving(true);
    setMatchMarkdownMessage("");

    try {
      const res = await fetch("/api/admin/match-markdowns", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...addAuthHeader(token),
        },
        body: JSON.stringify({
          date: predictionDate,
          entries: matchMarkdownGames.map((game) => ({
            gameId: game.id,
            markdownContent: matchMarkdowns[game.id] || "",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMatchMarkdownMessage(data.message || "Save failed.");
        return;
      }

      const nextMarkdowns = Array.isArray(data.matchMarkdowns)
        ? (data.matchMarkdowns as MatchMarkdown[]).reduce<Record<string, string>>((acc, entry) => {
            acc[entry.gameId] = entry.markdownContent || "";
            return acc;
          }, {})
        : {};

      setMatchMarkdowns(nextMarkdowns);
      setMatchMarkdownMessage("Match markdowns saved.");
    } catch {
      setMatchMarkdownMessage("Save failed due to network error.");
    } finally {
      setMatchMarkdownSaving(false);
    }
  }

  async function saveSocialProof() {
    if (!token) return;

    setSocialProofMessage("");
    try {
      const res = await fetch("/api/admin/social-proof-banner", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...addAuthHeader(token),
        },
        body: JSON.stringify({ messages: parseMessageInput(socialProofText) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSocialProofMessage(data.message || "Update failed.");
        return;
      }

      setSocialProofText(Array.isArray(data.banner?.messages) ? data.banner.messages.join("\n") : socialProofText);
      setSocialProofMessage("Social proof updated.");
    } catch {
      setSocialProofMessage("Update failed due to network error.");
    }
  }

  async function saveSiteCopy() {
    if (!token) return;

    setSiteCopyMessage("");
    try {
      const res = await fetch("/api/admin/site-copy", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...addAuthHeader(token),
        },
        body: JSON.stringify(siteCopy),
      });
      const data = await res.json();
      if (!res.ok) {
        setSiteCopyMessage(data.message || "Update failed.");
        return;
      }

      setSiteCopy({
        dailyCtaText: data.siteCopy?.dailyCtaText || DEFAULT_SITE_COPY.dailyCtaText,
        dailyPriceSubtext: data.siteCopy?.dailyPriceSubtext || DEFAULT_SITE_COPY.dailyPriceSubtext,
        noEdgeMessage: data.siteCopy?.noEdgeMessage || DEFAULT_SITE_COPY.noEdgeMessage,
        headerRightText: data.siteCopy?.headerRightText || DEFAULT_SITE_COPY.headerRightText,
        metaDescription: data.siteCopy?.metaDescription || DEFAULT_SITE_COPY.metaDescription,
        footerDisclaimer: data.siteCopy?.footerDisclaimer || DEFAULT_SITE_COPY.footerDisclaimer,
      });
      setSiteCopyMessage("Site copy updated.");
    } catch {
      setSiteCopyMessage("Update failed due to network error.");
    }
  }

  async function savePromoBanner() {
    if (!token) return;

    setPromoMessage("");
    try {
      const res = await fetch("/api/admin/promo-banner", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...addAuthHeader(token),
        },
        body: JSON.stringify(promoBanner),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoMessage(data.message || "Promo update failed.");
        return;
      }

      setPromoBanner({
        isActive: data.promoBanner?.isActive ?? false,
        bannerText: data.promoBanner?.bannerText || DEFAULT_PROMO_BANNER.bannerText,
        endDatetime: data.promoBanner?.endDatetime || "",
        updatedAt: data.promoBanner?.updatedAt || "",
      });
      setPromoMessage("Promo banner updated.");
    } catch {
      setPromoMessage("Promo update failed due to network error.");
    }
  }

  async function savePrompt() {
    if (!token) return;
    if (!promptText.trim()) {
      setPromptMessage("Prompt content is required.");
      return;
    }

    setPromptMessage("");
    try {
      const res = await fetch("/api/admin/system-prompt", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...addAuthHeader(token),
        },
        body: JSON.stringify({ content: promptText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromptMessage(data.message || "Prompt update failed.");
        return;
      }

      setPromptText("");
      setPromptMessage("Prompt saved.");
      setActivePrompt(data.prompt.content);
      await bootstrapAdmin(token);
    } catch {
      setPromptMessage("Update failed due to network error.");
    }
  }

  if (checking) {
    return (
      <main className="admin-shell">
        <div className="admin-loading">
          <div className="admin-loading__spinner" />
          <span>Loading admin panel...</span>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="admin-shell">
        <section className="admin-login-card">
          <div className="admin-section__header">
            <div>
              <div className="admin-eyebrow">LOCKIN</div>
              <h1 className="heading text-2xl text-[color:var(--pure-white)]">Admin Access</h1>
            </div>
          </div>

          <div className="space-y-4 p-6">
            <div>
              <label className="input-label" htmlFor="admin-username">Username</label>
              <input
                id="admin-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleLogin()}
                className="input-field mt-2"
              />
            </div>

            <div>
              <label className="input-label" htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleLogin()}
                className="input-field mt-2"
              />
            </div>

            <button type="button" onClick={handleLogin} className="primary-button primary-button--hero justify-center">
              Sign in
            </button>

            {loginMessage ? <p className="admin-message admin-message--error">{loginMessage}</p> : null}
          </div>
        </section>
      </main>
    );
  }

  const tabs = [
    { id: "predictions" as const, label: "Predictions" },
    { id: "social" as const, label: "Social Proof" },
    { id: "copy" as const, label: "Site Copy" },
    { id: "promo" as const, label: "Promo" },
    { id: "prompt" as const, label: "System Prompt" },
  ];

  return (
    <main className="admin-shell">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
        <header className="admin-header">
          <div>
            <div className="admin-eyebrow">LOCKIN ADMIN</div>
            <h1 className="heading text-2xl text-[color:var(--pure-white)]">Site Operations</h1>
          </div>
          <button
            type="button"
            onClick={() => clearStoredAuth()}
            className="secondary-button"
          >
            Logout
          </button>
        </header>

        <nav className="admin-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? "admin-tab admin-tab--active" : "admin-tab"}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "predictions" ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="space-y-6">
              <section className="admin-section">
                <div className="admin-section__header">
                  <div>
                    <div className="admin-eyebrow">{selectedPredictionId ? "EDITING" : "NEW ENTRY"}</div>
                    <h2 className="heading text-xl text-[color:var(--pure-white)]">Daily Prediction</h2>
                  </div>
                </div>

                <div className="space-y-5 p-6">
                  <div className="grid gap-4 md:grid-cols-[220px_auto]">
                    <div>
                      <label className="input-label" htmlFor="prediction-date">Date</label>
                      <input
                        id="prediction-date"
                        type="date"
                        value={predictionDate}
                        onChange={(event) => setPredictionDate(event.target.value)}
                        className="input-field mt-2"
                      />
                    </div>

                    <label className="admin-toggle">
                      <input
                        type="checkbox"
                        checked={isNoEdgeDay}
                        onChange={(event) => setIsNoEdgeDay(event.target.checked)}
                      />
                      <span>No Edge Today</span>
                    </label>
                  </div>

                  <div>
                    <label className="input-label" htmlFor="prediction-teaser">Hero Teaser</label>
                    <p className="admin-help">Keep this mysterious. No team names, no spoiler language.</p>
                    <textarea
                      id="prediction-teaser"
                      value={teaserText}
                      onChange={(event) => setTeaserText(event.target.value)}
                      rows={3}
                      className="input-field mt-2 resize-none"
                    />
                  </div>

                  <div>
                    <label className="input-label" htmlFor="prediction-markdown">Paid Markdown</label>
                    <p className="admin-help">Left side is raw markdown. Right side previews the unlocked card exactly.</p>
                    <div className="mt-2 grid gap-4 xl:grid-cols-2">
                      <textarea
                        id="prediction-markdown"
                        value={markdownContent}
                        onChange={(event) => setMarkdownContent(event.target.value)}
                        rows={18}
                        className="input-field mono resize-y text-sm"
                      />
                      <div className="admin-preview">
                        {markdownContent.trim() ? (
                          <MarkdownContent content={markdownContent} />
                        ) : (
                          <p className="text-sm text-[color:var(--silver-gray)]">Preview updates as you write.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={savePrediction}
                      disabled={predictionSaving}
                      className="primary-button justify-center disabled:opacity-50"
                    >
                      {predictionSaving ? "Saving..." : "Save prediction"}
                    </button>
                    <button type="button" onClick={clearPredictionForm} className="secondary-button">
                      Clear
                    </button>
                  </div>

                  {predictionMessage ? (
                    <p className={`admin-message ${predictionMessage.toLowerCase().includes("fail") || predictionMessage.toLowerCase().includes("required") ? "admin-message--error" : "admin-message--success"}`}>
                      {predictionMessage}
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="admin-section">
                <div className="admin-section__header">
                  <div>
                    <div className="admin-eyebrow">MATCH RAG</div>
                    <h2 className="heading text-xl text-[color:var(--pure-white)]">Match-Specific Markdown</h2>
                  </div>
                </div>

                <div className="space-y-5 p-6">
                  <p className="admin-help">
                    These notes are isolated by game. Only the selected game&apos;s markdown enters the LLM context.
                  </p>

                  {matchMarkdownLoading ? (
                    <div className="admin-preview text-sm text-[color:var(--silver-gray)]">Loading slate for {predictionDate}...</div>
                  ) : matchMarkdownGames.length === 0 ? (
                    <div className="admin-preview text-sm text-[color:var(--silver-gray)]">No games found for this date yet.</div>
                  ) : (
                    <div className="space-y-4">
                      {matchMarkdownGames.map((game) => (
                        <div key={game.id} className="admin-list-item space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="heading text-lg text-[color:var(--pure-white)]">{formatGameLabel(game)}</div>
                              <p className="mt-1 text-[11px] text-[color:var(--silver-gray)]">
                                {formatGameTime(game.gameTimeEST)} EST • {game.status.toUpperCase()}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-2">
                            <textarea
                              value={matchMarkdowns[game.id] || ""}
                              onChange={(event) =>
                                setMatchMarkdowns((current) => ({
                                  ...current,
                                  [game.id]: event.target.value,
                                }))
                              }
                              rows={10}
                              className="input-field mono resize-y text-sm"
                              placeholder={`Paste ${formatGameLabel(game)} engine markdown here...`}
                            />
                            <div className="admin-preview">
                              {(matchMarkdowns[game.id] || "").trim() ? (
                                <MarkdownContent content={matchMarkdowns[game.id] || ""} />
                              ) : (
                                <p className="text-sm text-[color:var(--silver-gray)]">No markdown saved for this game yet.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={saveMatchMarkdownEntries}
                    disabled={matchMarkdownSaving || matchMarkdownLoading}
                    className="primary-button justify-center disabled:opacity-50"
                  >
                    {matchMarkdownSaving ? "Saving..." : "Save match markdowns"}
                  </button>

                  {matchMarkdownMessage ? (
                    <p className={`admin-message ${matchMarkdownMessage.toLowerCase().includes("fail") ? "admin-message--error" : "admin-message--success"}`}>
                      {matchMarkdownMessage}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>

            <section className="admin-section">
              <div className="admin-section__header">
                <div>
                  <div className="admin-eyebrow">ARCHIVE</div>
                  <h2 className="heading text-xl text-[color:var(--pure-white)]">Saved Predictions</h2>
                </div>
              </div>

              <div className="space-y-3 p-4">
                {predictions.map((prediction) => (
                  <div key={prediction.id} className={`admin-list-item ${selectedPredictionId === prediction.id ? "admin-list-item--active" : ""}`}>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mono text-sm text-[color:var(--pure-white)]">{prediction.date}</span>
                        <span className="admin-pill">{prediction.source}</span>
                        {prediction.isNoEdgeDay ? <span className="admin-pill admin-pill--alert">No Edge</span> : null}
                      </div>
                      <p className="text-[11px] leading-5 text-[color:var(--silver-gray)]">
                        {prediction.teaserText || "No teaser text"}
                      </p>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => selectPrediction(prediction)} className="secondary-button">
                        Edit
                      </button>
                      <button type="button" onClick={() => deletePrediction(prediction.id)} className="admin-delete-button">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "social" ? (
          <section className="admin-section">
            <div className="admin-section__header">
              <div>
                <div className="admin-eyebrow">FOMO STRIP</div>
                <h2 className="heading text-xl text-[color:var(--pure-white)]">Social Proof Banner</h2>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <p className="admin-help">
                Enter one message per line. The public ticker rotates them in sequence and slows down automatically when more messages are present.
              </p>

              <div>
                <label className="input-label" htmlFor="social-proof">Banner messages</label>
                <textarea
                  id="social-proof"
                  value={socialProofText}
                  onChange={(event) => setSocialProofText(event.target.value)}
                  rows={5}
                  className="input-field mt-2 resize-none"
                />
              </div>

              <SocialProofBanner
                messages={socialProofMessages.length > 0 ? socialProofMessages : ["This Week: 5-0 (100%)", "+19.3u ROI"]}
              />

              <button type="button" onClick={saveSocialProof} className="primary-button justify-center">
                Save social proof
              </button>

              {socialProofMessage ? (
                <p className={`admin-message ${socialProofMessage.toLowerCase().includes("fail") ? "admin-message--error" : "admin-message--success"}`}>
                  {socialProofMessage}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === "copy" ? (
          <section className="admin-section">
            <div className="admin-section__header">
              <div>
                <div className="admin-eyebrow">SITE COPY</div>
                <h2 className="heading text-xl text-[color:var(--pure-white)]">Public UI Text Controls</h2>
              </div>
            </div>

            <div className="grid gap-5 p-6 xl:grid-cols-2">
              <div>
                <label className="input-label" htmlFor="copy-cta">CTA button text</label>
                <input
                  id="copy-cta"
                  value={siteCopy.dailyCtaText}
                  onChange={(event) => setSiteCopy((current) => ({ ...current, dailyCtaText: event.target.value }))}
                  className="input-field mt-2"
                />
              </div>

              <div>
                <label className="input-label" htmlFor="copy-price">CTA subtext</label>
                <input
                  id="copy-price"
                  value={siteCopy.dailyPriceSubtext}
                  onChange={(event) => setSiteCopy((current) => ({ ...current, dailyPriceSubtext: event.target.value }))}
                  className="input-field mt-2"
                  placeholder="$5 one-time pass"
                />
              </div>

              <div>
                <label className="input-label" htmlFor="copy-header">Header right text</label>
                <input
                  id="copy-header"
                  value={siteCopy.headerRightText}
                  onChange={(event) => setSiteCopy((current) => ({ ...current, headerRightText: event.target.value }))}
                  className="input-field mt-2"
                  placeholder="5-0 This Week"
                />
              </div>

              <div>
                <label className="input-label" htmlFor="copy-meta">Meta description</label>
                <input
                  id="copy-meta"
                  value={siteCopy.metaDescription}
                  onChange={(event) => setSiteCopy((current) => ({ ...current, metaDescription: event.target.value }))}
                  className="input-field mt-2"
                />
              </div>

              <div className="xl:col-span-2">
                <label className="input-label" htmlFor="copy-no-edge">No Edge day message</label>
                <textarea
                  id="copy-no-edge"
                  value={siteCopy.noEdgeMessage}
                  onChange={(event) => setSiteCopy((current) => ({ ...current, noEdgeMessage: event.target.value }))}
                  rows={4}
                  className="input-field mt-2 resize-none"
                />
              </div>

              <div className="xl:col-span-2">
                <label className="input-label" htmlFor="copy-footer">Footer disclaimer</label>
                <textarea
                  id="copy-footer"
                  value={siteCopy.footerDisclaimer}
                  onChange={(event) => setSiteCopy((current) => ({ ...current, footerDisclaimer: event.target.value }))}
                  rows={4}
                  className="input-field mt-2 resize-none"
                />
              </div>

              <div className="xl:col-span-2">
                <button type="button" onClick={saveSiteCopy} className="primary-button justify-center">
                  Save site copy
                </button>
              </div>

              {siteCopyMessage ? (
                <div className="xl:col-span-2">
                  <p className={`admin-message ${siteCopyMessage.toLowerCase().includes("fail") ? "admin-message--error" : "admin-message--success"}`}>
                    {siteCopyMessage}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === "promo" ? (
          <section className="admin-section">
            <div className="admin-section__header">
              <div>
                <div className="admin-eyebrow">LAUNCH MODE</div>
                <h2 className="heading text-xl text-[color:var(--pure-white)]">Promo Banner</h2>
              </div>
            </div>

            <div className="grid gap-5 p-6 xl:grid-cols-2">
              <label className="admin-toggle">
                <input
                  type="checkbox"
                  checked={promoBanner.isActive}
                  onChange={(event) => setPromoBanner((current) => ({ ...current, isActive: event.target.checked }))}
                />
                <span>Promo Banner Active</span>
              </label>

              <div>
                <label className="input-label" htmlFor="promo-end">End datetime</label>
                <input
                  id="promo-end"
                  type="datetime-local"
                  value={toDateTimeLocalValue(promoBanner.endDatetime)}
                  onChange={(event) =>
                    setPromoBanner((current) => ({
                      ...current,
                      endDatetime: event.target.value ? new Date(event.target.value).toISOString() : "",
                    }))
                  }
                  className="input-field mt-2"
                />
              </div>

              <div className="xl:col-span-2">
                <label className="input-label" htmlFor="promo-copy">Promo banner text</label>
                <textarea
                  id="promo-copy"
                  value={promoBanner.bannerText}
                  onChange={(event) => setPromoBanner((current) => ({ ...current, bannerText: event.target.value }))}
                  rows={4}
                  className="input-field mt-2 resize-none"
                />
              </div>

              <div className="xl:col-span-2 admin-preview">
                <p className="text-sm text-[color:var(--pure-white)]">
                  {promoBanner.isActive ? "Promo is armed." : "Promo is disabled."}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-[color:var(--silver-gray)]">
                  When active, the public page swaps paid CTA copy to free-access copy and requires email before direct unlock.
                </p>
              </div>

              <div className="xl:col-span-2">
                <button type="button" onClick={savePromoBanner} className="primary-button justify-center">
                  Save promo settings
                </button>
              </div>

              {promoMessage ? (
                <div className="xl:col-span-2">
                  <p className={`admin-message ${promoMessage.toLowerCase().includes("fail") ? "admin-message--error" : "admin-message--success"}`}>
                    {promoMessage}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === "prompt" ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="admin-section">
              <div className="admin-section__header">
                <div>
                  <div className="admin-eyebrow">MODEL CONTROL</div>
                  <h2 className="heading text-xl text-[color:var(--pure-white)]">System Prompt</h2>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div>
                  <label className="input-label">Active prompt</label>
                  <div className="admin-preview mt-2">
                    {activePrompt || <span className="text-sm text-[color:var(--silver-gray)]">No active prompt configured.</span>}
                  </div>
                </div>

                <div>
                  <label className="input-label" htmlFor="prompt-text">New prompt</label>
                  <textarea
                    id="prompt-text"
                    value={promptText}
                    onChange={(event) => setPromptText(event.target.value)}
                    rows={10}
                    className="input-field mt-2 resize-y"
                  />
                </div>

                <button type="button" onClick={savePrompt} className="primary-button justify-center">
                  Save prompt
                </button>

                {promptMessage ? (
                  <p className={`admin-message ${promptMessage.toLowerCase().includes("fail") || promptMessage.toLowerCase().includes("required") ? "admin-message--error" : "admin-message--success"}`}>
                    {promptMessage}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="admin-section">
              <div className="admin-section__header">
                <div>
                  <div className="admin-eyebrow">LAST 5</div>
                  <h2 className="heading text-xl text-[color:var(--pure-white)]">Prompt History</h2>
                </div>
              </div>

              <div className="space-y-3 p-4">
                {promptHistory.slice(0, 5).map((prompt) => (
                  <div key={prompt.id} className="admin-list-item">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="admin-pill">v{prompt.version}</span>
                      {prompt.isActive ? <span className="admin-pill admin-pill--success">Active</span> : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--silver-gray)]">
                      {prompt.content}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
