"use client";

import { useEffect, useState } from "react";

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

const ADMIN_TOKEN_KEY = "lockin_admin_token";

function estDateInputValue(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

function addAuthHeader(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
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

  const [socialProofText, setSocialProofText] = useState("");
  const [socialProofMessage, setSocialProofMessage] = useState("");

  const [activePrompt, setActivePrompt] = useState("");
  const [promptHistory, setPromptHistory] = useState<SystemPrompt[]>([]);
  const [promptText, setPromptText] = useState("");
  const [promptMessage, setPromptMessage] = useState("");

  const [activeTab, setActiveTab] = useState<"predictions" | "social" | "prompt">("predictions");

  async function bootstrapAdmin(tokenValue: string | null) {
    if (!tokenValue) return;
    try {
      const [predictionsResponse, proofResponse, promptResponse] = await Promise.all([
        fetch("/api/admin/predictions", { headers: addAuthHeader(tokenValue) }),
        fetch("/api/admin/social-proof-banner", { headers: addAuthHeader(tokenValue) }),
        fetch("/api/admin/system-prompt", { headers: addAuthHeader(tokenValue) }),
      ]);

      if (predictionsResponse.status === 401 || proofResponse.status === 401 || promptResponse.status === 401) {
        window.localStorage.removeItem(ADMIN_TOKEN_KEY);
        setToken(null);
        setChecking(false);
        return;
      }

      const predictionsBody = await predictionsResponse.json();
      const proofBody = await proofResponse.json();
      const promptBody = await promptResponse.json();

      setPredictions(predictionsBody.predictions || []);
      setSocialProofText(proofBody.banner || "");
      setActivePrompt(promptBody.active?.content || "");
      setPromptHistory(promptBody.history || []);
    } catch {
      setPredictionMessage("Failed to load admin data.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      bootstrapAdmin(savedToken).catch(() => setChecking(false));
      return;
    }
    setChecking(false);
  }, []);

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
    setTeaserText("");
    setMarkdownContent("");
    setIsNoEdgeDay(false);
    setPredictionDate(estDateInputValue());
    setPredictionMessage("");
  }

  async function savePrediction() {
    if (!token) return;
    setPredictionMessage("");
    if (!predictionDate || (!isNoEdgeDay && (!teaserText || !markdownContent))) {
      setPredictionMessage("Date is required. Teaser and content are required unless No Edge day.");
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
      setPredictionMessage("Prediction saved successfully.");
      setSelectedPredictionId(data.prediction.id);
      await bootstrapAdmin(token);
    } catch {
      setPredictionMessage("Save failed due to network error.");
    } finally {
      setPredictionSaving(false);
    }
  }

  async function deletePrediction(id: string) {
    if (!token) return;
    setPredictionMessage("");
    if (!confirm("Are you sure you want to delete this prediction?")) return;
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
      setPredictionMessage("Prediction deleted.");
      if (selectedPredictionId === id) {
        clearPredictionForm();
      }
      await bootstrapAdmin(token);
    } catch {
      setPredictionMessage("Delete failed due to network error.");
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
        body: JSON.stringify({ text: socialProofText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSocialProofMessage(data.message || "Update failed.");
        return;
      }
      setSocialProofMessage(`Banner ${data.banner?.isActive ? "updated and active" : "cleared"}.`);
    } catch {
      setSocialProofMessage("Update failed due to network error.");
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
      setPromptMessage("Prompt saved successfully.");
      setActivePrompt(data.prompt.content);
      await bootstrapAdmin(token);
    } catch {
      setPromptMessage("Update failed due to network error.");
    }
  }

  /* ─── Loading State ─── */
  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0e1a] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00c853]/30 border-t-[#00c853]" />
          <span className="text-sm text-[#8b92a5]">Loading admin panel...</span>
        </div>
      </main>
    );
  }

  /* ─── Login Screen ─── */
  if (!token) {
    return (
      <main className="min-h-screen bg-[#0a0e1a] text-white">
        <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
          <div className="fade-in w-full overflow-hidden rounded-2xl border border-[#2a3852]/60 bg-gradient-to-b from-[#111829] to-[#0d1422] shadow-2xl shadow-black/40">
            {/* Top accent line */}
            <div className="h-px bg-gradient-to-r from-transparent via-[#00c853]/50 to-transparent" />

            <div className="p-8">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#00c853]/20 to-[#00c853]/5 ring-1 ring-[#00c853]/20">
                  <svg className="h-6 w-6 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h1 className="heading text-2xl font-bold text-white">LOCKIN Admin</h1>
                <p className="mt-1.5 text-sm text-[#8b92a5]">Sign in to manage predictions and settings</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8b92a5]">Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#8b92a5]">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogin}
                className="btn-glow mt-6 w-full rounded-xl bg-gradient-to-r from-[#00c853] to-[#00b848] py-3 font-bold text-black transition hover:from-[#00ff87] hover:to-[#00c853]"
              >
                Sign in
              </button>

              {loginMessage && (
                <div className="mt-4 rounded-lg border border-[#ff3b3b]/20 bg-[#ff3b3b]/[0.06] px-4 py-2.5 text-center text-sm text-[#ff3b3b]">
                  {loginMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ─── Tab Config ─── */
  const tabs = [
    {
      id: "predictions" as const,
      label: "Predictions",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: "social" as const,
      label: "Social Proof",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      ),
    },
    {
      id: "prompt" as const,
      label: "System Prompt",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
    },
  ];

  /* ─── Dashboard ─── */
  return (
    <main className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <header className="mb-8 overflow-hidden rounded-2xl border border-[#2a3852]/60 bg-gradient-to-r from-[#111829] via-[#0f1d2f] to-[#111829]">
          <div className="h-px bg-gradient-to-r from-transparent via-[#00c853]/40 to-transparent" />
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00c853]/20 to-[#00c853]/5 ring-1 ring-[#00c853]/20">
                <svg className="h-5 w-5 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="heading text-xl font-bold text-white">LOCKIN Admin</h1>
                <p className="text-xs text-[#8b92a5]">Dashboard &middot; Manage predictions, banners &amp; prompts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-1.5 rounded-full border border-[#00c853]/20 bg-[#00c853]/[0.06] px-3 py-1 sm:flex">
                <span className="glow-dot" style={{ width: 6, height: 6 }} />
                <span className="text-xs text-[#00c853]">Connected</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
                  setToken(null);
                }}
                className="rounded-lg border border-[#ff3b3b]/30 bg-[#ff3b3b]/[0.06] px-4 py-2 text-sm font-medium text-[#ff3b3b] transition hover:border-[#ff3b3b]/50 hover:bg-[#ff3b3b]/10"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="mb-6 overflow-hidden rounded-xl border border-[#2a3852]/60 bg-[#111829]/80 p-1.5">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-[#00c853] to-[#00b848] text-black shadow-lg shadow-[#00c853]/10"
                    : "text-[#8b92a5] hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Predictions Tab ═══ */}
        {activeTab === "predictions" && (
          <div className="fade-in space-y-6">
            {/* Prediction Form */}
            <section className="overflow-hidden rounded-2xl border border-[#2a3852]/60 bg-gradient-to-b from-[#111829] to-[#0d1422]">
              <div className="border-b border-[#2a3852]/30 px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#00c853]" />
                  <h2 className="heading text-lg font-semibold text-white">
                    {selectedPredictionId ? "Edit Prediction" : "New Prediction"}
                  </h2>
                </div>
              </div>
              <div className="p-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#8b92a5]">Date</label>
                    <input
                      type="date"
                      value={predictionDate}
                      onChange={(e) => setPredictionDate(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#2a3852]/60 bg-[#0a0e1a]/60 px-4 py-3 transition hover:border-[#ff6b35]/40">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={isNoEdgeDay}
                          onChange={(e) => setIsNoEdgeDay(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-[#2a3852] transition peer-checked:bg-[#ff6b35]" />
                        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
                      </div>
                      <span className="text-sm text-[#8b92a5]">No Edge Day</span>
                    </label>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-1.5 block text-xs font-medium text-[#8b92a5]">Teaser Text</label>
                  <p className="mb-2 text-xs text-[#8b92a5]">Use two short lines. This is the locked preview shown on the homepage.</p>
                  <textarea
                    value={teaserText}
                    onChange={(e) => setTeaserText(e.target.value)}
                    rows={2}
                    className="input-field w-full resize-none"
                  />
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium text-[#8b92a5]">Prediction Content (Markdown)</label>
                  <p className="mb-2 text-xs text-[#8b92a5]">Write the full paid report in markdown. Include the lean, support and risk.</p>
                  <textarea
                    value={markdownContent}
                    onChange={(e) => setMarkdownContent(e.target.value)}
                    rows={10}
                    className="input-field mono w-full resize-y text-sm"
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={savePrediction}
                    disabled={predictionSaving}
                    className="btn-glow flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00c853] to-[#00b848] px-6 py-2.5 font-semibold text-black transition hover:from-[#00ff87] hover:to-[#00c853] disabled:opacity-50"
                  >
                    {predictionSaving ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Save Prediction
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={clearPredictionForm}
                    className="rounded-xl border border-[#2a3852]/60 px-5 py-2.5 text-sm text-[#8b92a5] transition hover:border-white/20 hover:text-white"
                  >
                    Clear / New
                  </button>
                </div>

                {predictionMessage && (
                  <div className={`mt-4 rounded-lg border px-4 py-2.5 text-sm ${
                    predictionMessage.includes("failed") || predictionMessage.includes("required")
                      ? "border-[#ff3b3b]/20 bg-[#ff3b3b]/[0.06] text-[#ff3b3b]"
                      : "border-[#00c853]/20 bg-[#00c853]/[0.06] text-[#00c853]"
                  }`}>
                    {predictionMessage}
                  </div>
                )}
              </div>
            </section>

            {/* Past Predictions List */}
            {predictions.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-[#2a3852]/60 bg-gradient-to-b from-[#111829] to-[#0d1422]">
                <div className="border-b border-[#2a3852]/30 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-[#8b92a5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h2 className="heading text-lg font-semibold text-white">Past Predictions</h2>
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-[#8b92a5]">
                      {predictions.length} total
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-[#2a3852]/20 p-3">
                  {predictions.map((prediction) => (
                    <div
                      key={prediction.id}
                      className={`group rounded-xl p-4 transition ${
                        selectedPredictionId === prediction.id
                          ? "bg-[#00c853]/[0.06] ring-1 ring-[#00c853]/30"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="mono text-sm font-medium text-white">{prediction.date}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              prediction.source === "admin"
                                ? "border border-[#00c853]/30 bg-[#00c853]/10 text-[#00c853]"
                                : "border border-[#ffd700]/30 bg-[#ffd700]/10 text-[#ffd700]"
                            }`}>
                              {prediction.source}
                            </span>
                            {prediction.isNoEdgeDay && (
                              <span className="rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-2 py-0.5 text-[10px] font-medium text-[#ff6b35]">
                                No Edge
                              </span>
                            )}
                            {selectedPredictionId === prediction.id && (
                              <span className="rounded-full border border-[#00c853]/30 bg-[#00c853]/10 px-2 py-0.5 text-[10px] font-medium text-[#00c853]">
                                Editing
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-[#8b92a5]">{prediction.teaserText || "No teaser text"}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => selectPrediction(prediction)}
                            className="rounded-lg border border-[#00c853]/20 bg-[#00c853]/[0.06] px-3.5 py-1.5 text-xs font-medium text-[#00c853] transition hover:border-[#00c853]/40 hover:bg-[#00c853]/10"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePrediction(prediction.id)}
                            className="rounded-lg border border-[#ff3b3b]/20 bg-[#ff3b3b]/[0.06] px-3.5 py-1.5 text-xs font-medium text-[#ff3b3b] transition hover:border-[#ff3b3b]/40 hover:bg-[#ff3b3b]/10"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ═══ Social Proof Tab ═══ */}
        {activeTab === "social" && (
          <div className="fade-in">
            <section className="overflow-hidden rounded-2xl border border-[#2a3852]/60 bg-gradient-to-b from-[#111829] to-[#0d1422]">
              <div className="border-b border-[#2a3852]/30 px-6 py-4">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-[#ffd700]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  <h2 className="heading text-lg font-semibold text-white">Social Proof Banner</h2>
                </div>
              </div>
              <div className="p-6">
                <p className="mb-4 rounded-lg border border-[#2a3852]/30 bg-[#0a0e1a]/40 px-4 py-3 text-xs leading-relaxed text-[#8b92a5]">
                  This banner appears at the top of the home page. Leave empty to hide it.
                </p>

                <label className="mb-1.5 block text-xs font-medium text-[#8b92a5]">Banner Text</label>
                <textarea
                  value={socialProofText}
                  onChange={(e) => setSocialProofText(e.target.value)}
                  rows={2}
                  className="input-field mb-4 w-full resize-none"
                />

                {socialProofText && (
                  <div className="mb-5 overflow-hidden rounded-xl border border-[#00c853]/20 bg-gradient-to-r from-[#00c853]/[0.06] via-[#101a2c] to-[#00c853]/[0.06]">
                    <div className="px-1 py-0.5 text-center text-[10px] font-medium uppercase tracking-wider text-[#8b92a5]">Live Preview</div>
                    <div className="flex items-center justify-center gap-2 px-4 py-3">
                      <span className="glow-dot" style={{ width: 6, height: 6 }} />
                      <span className="mono text-sm tracking-wide text-[#00ff87]">{socialProofText}</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={saveSocialProof}
                  className="btn-glow flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00c853] to-[#00b848] px-6 py-2.5 font-semibold text-black transition hover:from-[#00ff87] hover:to-[#00c853]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Update Banner
                </button>

                {socialProofMessage && (
                  <div className={`mt-4 rounded-lg border px-4 py-2.5 text-sm ${
                    socialProofMessage.includes("failed")
                      ? "border-[#ff3b3b]/20 bg-[#ff3b3b]/[0.06] text-[#ff3b3b]"
                      : "border-[#00c853]/20 bg-[#00c853]/[0.06] text-[#00c853]"
                  }`}>
                    {socialProofMessage}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ═══ System Prompt Tab ═══ */}
        {activeTab === "prompt" && (
          <div className="fade-in space-y-6">
            <section className="overflow-hidden rounded-2xl border border-[#2a3852]/60 bg-gradient-to-b from-[#111829] to-[#0d1422]">
              <div className="border-b border-[#2a3852]/30 px-6 py-4">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <h2 className="heading text-lg font-semibold text-white">System Prompt</h2>
                </div>
              </div>
              <div className="p-6">
                {/* Active Prompt Display */}
                <div className="mb-5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="glow-dot" style={{ width: 6, height: 6 }} />
                    <span className="text-xs font-medium text-[#00c853]">Active Prompt</span>
                  </div>
                  <div className="rounded-xl border border-[#2a3852]/40 bg-[#0a0e1a]/60 p-4 text-sm leading-relaxed text-[#f5f5f3]">
                    {activePrompt || <span className="italic text-[#8b92a5]">No active prompt configured.</span>}
                  </div>
                </div>

                {/* New Prompt Input */}
                <label className="mb-1.5 block text-xs font-medium text-[#8b92a5]">New Prompt</label>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={6}
                  className="input-field w-full resize-y"
                />

                <button
                  type="button"
                  onClick={savePrompt}
                  className="btn-glow mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00c853] to-[#00b848] px-6 py-2.5 font-semibold text-black transition hover:from-[#00ff87] hover:to-[#00c853]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Save Prompt
                </button>

                {promptMessage && (
                  <div className={`mt-4 rounded-lg border px-4 py-2.5 text-sm ${
                    promptMessage.includes("failed") || promptMessage.includes("required")
                      ? "border-[#ff3b3b]/20 bg-[#ff3b3b]/[0.06] text-[#ff3b3b]"
                      : "border-[#00c853]/20 bg-[#00c853]/[0.06] text-[#00c853]"
                  }`}>
                    {promptMessage}
                  </div>
                )}
              </div>
            </section>

            {/* Prompt History */}
            {promptHistory.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-[#2a3852]/60 bg-gradient-to-b from-[#111829] to-[#0d1422]">
                <div className="border-b border-[#2a3852]/30 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-[#8b92a5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h2 className="heading text-lg font-semibold text-white">Prompt History</h2>
                    </div>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-[#8b92a5]">
                      {promptHistory.length} versions
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-[#2a3852]/20 p-3">
                  {promptHistory.slice(0, 5).map((prompt) => (
                    <div key={prompt.id} className="rounded-xl p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="mono rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#8b92a5]">
                          v{prompt.version}
                        </span>
                        {prompt.isActive && (
                          <span className="rounded-full border border-[#00c853]/30 bg-[#00c853]/10 px-2 py-0.5 text-[10px] font-medium text-[#00c853]">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#f5f5f3]/80">{prompt.content}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
