"use client";

import { useEffect, useState } from "react";

type AdminPrediction = {
  id: string;
  date: string;
  teaserText: string;
  markdownContent: string;
  isNoEdgeDay: boolean;
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

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0e1a] text-white">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#00c853] border-t-transparent" />
          <span className="text-[#8b92a5]">Loading admin panel...</span>
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[#0a0e1a] text-white">
        <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
          <div className="w-full rounded-xl border border-white/10 bg-[#111829] p-6">
            <div className="mb-6 text-center">
              <h1 className="heading text-2xl text-white">LOCKIN Admin</h1>
              <p className="mt-1 text-xs text-[#8b92a5]">Sign in to manage predictions and settings</p>
            </div>
            <label className="mb-3 block text-sm">
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="mt-1 w-full rounded-lg border border-[#2a3852] bg-[#0a0e1a] p-2.5 text-white outline-none transition focus:border-[#00c853]"
                placeholder="admin"
              />
            </label>
            <label className="mb-5 block text-sm">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="mt-1 w-full rounded-lg border border-[#2a3852] bg-[#0a0e1a] p-2.5 text-white outline-none transition focus:border-[#00c853]"
              />
            </label>
            <button
              type="button"
              onClick={handleLogin}
              className="w-full rounded-lg bg-[#00c853] py-2.5 font-semibold text-black transition hover:bg-[#00ff87]"
            >
              Sign in
            </button>
            {loginMessage && <p className="mt-3 text-center text-sm text-[#ff3b3b]">{loginMessage}</p>}
          </div>
        </div>
      </main>
    );
  }

  const tabs = [
    { id: "predictions" as const, label: "Daily Predictions" },
    { id: "social" as const, label: "Social Proof" },
    { id: "prompt" as const, label: "System Prompt" },
  ];

  return (
    <main className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="heading text-2xl">LOCKIN Admin</h1>
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem(ADMIN_TOKEN_KEY);
              setToken(null);
            }}
            className="rounded-lg border border-[#ff3b3b]/50 px-3 py-1.5 text-sm text-[#ff3b3b] transition hover:bg-[#ff3b3b]/10"
          >
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-[#2a3852] bg-[#111829] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-md px-3 py-2 text-sm transition ${
                activeTab === tab.id
                  ? "bg-[#00c853] font-semibold text-black"
                  : "text-[#8b92a5] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Predictions Tab */}
        {activeTab === "predictions" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[#2a3852] bg-[#111829] p-5">
              <h2 className="mb-4 text-lg font-semibold">
                {selectedPredictionId ? "Edit Prediction" : "New Prediction"}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  Date
                  <input
                    type="date"
                    value={predictionDate}
                    onChange={(e) => setPredictionDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#2a3852] bg-[#0a0e1a] p-2.5 text-white outline-none transition focus:border-[#00c853]"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm md:pt-7">
                  <input
                    type="checkbox"
                    checked={isNoEdgeDay}
                    onChange={(e) => setIsNoEdgeDay(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  No Edge Day
                </label>
              </div>
              <label className="mt-3 block text-sm">
                Teaser Text
                <textarea
                  value={teaserText}
                  onChange={(e) => setTeaserText(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[#2a3852] bg-[#0a0e1a] p-2.5 text-white outline-none transition focus:border-[#00c853]"
                  placeholder="Tonight's top edge: ..."
                />
              </label>
              <label className="mt-3 block text-sm">
                Prediction Content (Markdown)
                <textarea
                  value={markdownContent}
                  onChange={(e) => setMarkdownContent(e.target.value)}
                  rows={10}
                  className="mt-1 w-full rounded-lg border border-[#2a3852] bg-[#0a0e1a] p-2.5 font-mono text-sm text-white outline-none transition focus:border-[#00c853]"
                  placeholder="## Lock details&#10;&#10;- Key stat 1&#10;- Key stat 2"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={savePrediction}
                  disabled={predictionSaving}
                  className="rounded-lg bg-[#00c853] px-5 py-2 font-semibold text-black transition hover:bg-[#00ff87] disabled:opacity-50"
                >
                  {predictionSaving ? "Saving..." : "Save Prediction"}
                </button>
                <button
                  type="button"
                  onClick={clearPredictionForm}
                  className="rounded-lg border border-[#2a3852] px-5 py-2 text-[#8b92a5] transition hover:border-white/30 hover:text-white"
                >
                  Clear / New
                </button>
              </div>
              {predictionMessage && (
                <p className={`mt-3 text-sm ${predictionMessage.includes("failed") || predictionMessage.includes("required") ? "text-[#ff3b3b]" : "text-[#00c853]"}`}>
                  {predictionMessage}
                </p>
              )}
            </div>

            {predictions.length > 0 && (
              <div className="rounded-xl border border-[#2a3852] bg-[#111829] p-5">
                <h2 className="mb-4 text-lg font-semibold">Past Predictions</h2>
                <div className="space-y-2">
                  {predictions.map((prediction) => (
                    <div
                      key={prediction.id}
                      className={`rounded-lg border p-3 transition ${
                        selectedPredictionId === prediction.id
                          ? "border-[#00c853] bg-[#00c853]/5"
                          : "border-[#2a3852] hover:border-[#2a3852]/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <strong className="mono">{prediction.date}</strong>
                            {prediction.isNoEdgeDay && (
                              <span className="rounded-full bg-[#ff6b35]/15 px-2 py-0.5 text-[10px] text-[#ff6b35]">
                                No Edge
                              </span>
                            )}
                          </div>
                          <div className="mt-1 truncate text-xs text-[#8b92a5]">
                            {prediction.teaserText}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => selectPrediction(prediction)}
                            className="rounded-lg bg-[#00c853]/15 px-3 py-1.5 text-xs text-[#00c853] transition hover:bg-[#00c853]/25"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePrediction(prediction.id)}
                            className="rounded-lg bg-[#ff3b3b]/15 px-3 py-1.5 text-xs text-[#ff3b3b] transition hover:bg-[#ff3b3b]/25"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Social Proof Tab */}
        {activeTab === "social" && (
          <div className="rounded-xl border border-[#2a3852] bg-[#111829] p-5">
            <h2 className="mb-4 text-lg font-semibold">Social Proof Banner</h2>
            <p className="mb-3 text-xs text-[#8b92a5]">
              This banner appears at the top of the home page. Leave empty to hide it.
            </p>
            <textarea
              value={socialProofText}
              onChange={(e) => setSocialProofText(e.target.value)}
              rows={2}
              className="mb-3 w-full rounded-lg border border-[#2a3852] bg-[#0a0e1a] p-2.5 text-white outline-none transition focus:border-[#00c853]"
              placeholder="Yesterday: 4-1 (+3.5u) | Last 7 Days: 18-9 (67% Win Rate)"
            />
            {socialProofText && (
              <div className="mb-3 rounded-lg border border-[#00c853]/35 bg-[#101a2c] p-3 text-center text-sm text-[#00ff87]">
                Preview: {socialProofText}
              </div>
            )}
            <button
              type="button"
              onClick={saveSocialProof}
              className="rounded-lg bg-[#00c853] px-5 py-2 font-semibold text-black transition hover:bg-[#00ff87]"
            >
              Update Banner
            </button>
            {socialProofMessage && (
              <p className={`mt-3 text-sm ${socialProofMessage.includes("failed") ? "text-[#ff3b3b]" : "text-[#00c853]"}`}>
                {socialProofMessage}
              </p>
            )}
          </div>
        )}

        {/* System Prompt Tab */}
        {activeTab === "prompt" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[#2a3852] bg-[#111829] p-5">
              <h2 className="mb-4 text-lg font-semibold">System Prompt</h2>
              <div className="mb-4">
                <div className="mb-1 text-xs font-medium text-[#8b92a5]">Active Prompt</div>
                <div className="rounded-lg border border-[#2a3852] bg-[#0a0e1a] p-3 text-sm text-[#f5f5f3]">
                  {activePrompt || <span className="text-[#8b92a5]">No active prompt configured.</span>}
                </div>
              </div>
              <label className="block text-sm">
                New Prompt
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-[#2a3852] bg-[#0a0e1a] p-2.5 text-white outline-none transition focus:border-[#00c853]"
                  placeholder="Enter the new system prompt content..."
                />
              </label>
              <button
                type="button"
                onClick={savePrompt}
                className="mt-3 rounded-lg bg-[#00c853] px-5 py-2 font-semibold text-black transition hover:bg-[#00ff87]"
              >
                Save Prompt
              </button>
              {promptMessage && (
                <p className={`mt-3 text-sm ${promptMessage.includes("failed") || promptMessage.includes("required") ? "text-[#ff3b3b]" : "text-[#00c853]"}`}>
                  {promptMessage}
                </p>
              )}
            </div>

            {promptHistory.length > 0 && (
              <div className="rounded-xl border border-[#2a3852] bg-[#111829] p-5">
                <h2 className="mb-4 text-lg font-semibold">Prompt History</h2>
                <div className="space-y-3">
                  {promptHistory.slice(0, 5).map((prompt) => (
                    <div key={prompt.id} className="rounded-lg border border-[#2a3852] p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs">
                        <span className="mono text-[#8b92a5]">v{prompt.version}</span>
                        {prompt.isActive && (
                          <span className="rounded-full bg-[#00c853]/15 px-2 py-0.5 text-[10px] text-[#00c853]">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-sm text-[#f5f5f3]">{prompt.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
