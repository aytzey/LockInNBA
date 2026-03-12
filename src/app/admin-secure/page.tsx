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

  const [socialProofText, setSocialProofText] = useState("");
  const [socialProofMessage, setSocialProofMessage] = useState("");

  const [activePrompt, setActivePrompt] = useState("");
  const [promptHistory, setPromptHistory] = useState<SystemPrompt[]>([]);
  const [promptText, setPromptText] = useState("");
  const [promptMessage, setPromptMessage] = useState("");

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
  }

  function selectPrediction(prediction: AdminPrediction) {
    setSelectedPredictionId(prediction.id);
    setPredictionDate(prediction.date);
    setTeaserText(prediction.teaserText);
    setMarkdownContent(prediction.markdownContent);
    setIsNoEdgeDay(prediction.isNoEdgeDay);
    setPredictionMessage("");
  }

  async function savePrediction() {
    if (!token) return;
    setPredictionMessage("");
    if (!predictionDate || (!isNoEdgeDay && (!teaserText || !markdownContent))) {
      setPredictionMessage("Date is required. Teaser and markdown are required unless this is a No Edge day.");
      return;
    }
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
          markdownContent: isNoEdgeDay ? markdownContent : markdownContent,
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
    } catch {
      setPredictionMessage("Save failed due to network error.");
    }
  }

  async function deletePrediction(id: string) {
    if (!token) return;
    setPredictionMessage("");
    if (!confirm("Delete this prediction entry?")) return;
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
      setSelectedPredictionId("");
      setPredictionDate(estDateInputValue());
      setTeaserText("");
      setMarkdownContent("");
      setIsNoEdgeDay(false);
    }
    await bootstrapAdmin(token);
  }

  async function saveSocialProof() {
    if (!token) return;
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
    setSocialProofMessage(`Updated: ${data.banner?.isActive ? "active" : "hidden"}.`);
  }

  async function savePrompt() {
    if (!token) return;
    if (!promptText.trim()) {
      setPromptMessage("Prompt content required.");
      return;
    }
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
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-[#0a0e1a] text-white">
        <div className="mx-auto max-w-4xl px-4 py-12">Loading admin...</div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[#0a0e1a] text-white">
        <div className="mx-auto flex min-h-screen max-w-xl items-center px-4">
          <div className="w-full rounded-lg border border-white/10 bg-[#111829] p-6">
            <h1 className="mb-4 text-2xl">LOCKIN Admin Login</h1>
            <label className="mb-3 block">
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-1 w-full rounded border border-[#2a3852] bg-[#0a0e1a] p-2"
                placeholder="admin"
              />
            </label>
            <label className="mb-4 block">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded border border-[#2a3852] bg-[#0a0e1a] p-2"
              />
            </label>
            <button
              type="button"
              onClick={handleLogin}
              className="w-full rounded bg-[#00c853] py-2 text-black"
            >
              Sign in
            </button>
            {loginMessage ? <p className="mt-3 text-sm text-[#ff3b3b]">{loginMessage}</p> : null}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl">LOCKIN Admin</h1>
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem(ADMIN_TOKEN_KEY);
              setToken(null);
            }}
            className="rounded border border-[#ff3b3b] px-3 py-1 text-[#ff3b3b]"
          >
            Logout
          </button>
        </div>

        <section className="grid gap-5">
          <div className="rounded-lg border border-[#2a3852] bg-[#111829] p-4">
            <h2 className="mb-3 text-xl">Günlük Tahmin Yönetimi</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                Tarih
                <input
                  type="date"
                  value={predictionDate}
                  onChange={(event) => setPredictionDate(event.target.value)}
                  className="mt-1 w-full rounded border border-[#2a3852] bg-[#0a0e1a] p-2"
                />
              </label>
              <label className="flex items-center gap-2 md:pt-7">
                <input
                  type="checkbox"
                  checked={isNoEdgeDay}
                  onChange={(event) => setIsNoEdgeDay(event.target.checked)}
                />
                No Edge Today
              </label>
            </div>
            <label className="mb-2 mt-2 block">
              Teaser (Away @ Home)
              <textarea
                value={teaserText}
                onChange={(event) => setTeaserText(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-[#2a3852] bg-[#0a0e1a] p-2"
                placeholder="Tonight's top edge..."
              />
            </label>
            <label className="mb-3 block">
              Tahmin İçeriği (Markdown)
              <textarea
                value={markdownContent}
                onChange={(event) => setMarkdownContent(event.target.value)}
                rows={10}
                className="mt-1 w-full rounded border border-[#2a3852] bg-[#0a0e1a] p-2"
                placeholder="## Lock details"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={savePrediction}
                className="rounded bg-[#00c853] px-4 py-2 text-black"
              >
                Save Prediction
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPredictionId("");
                  setTeaserText("");
                  setMarkdownContent("");
                  setIsNoEdgeDay(false);
                  setPredictionDate(estDateInputValue());
                }}
                className="rounded border border-[#00c853] px-4 py-2"
              >
                New Entry
              </button>
            </div>
            {predictionMessage ? <p className="mt-2 text-sm text-[#8b92a5]">{predictionMessage}</p> : null}
          </div>

          <div className="rounded-lg border border-[#2a3852] bg-[#111829] p-4">
            <h2 className="mb-3 text-xl">Social Proof Banner</h2>
            <textarea
              value={socialProofText}
              onChange={(event) => setSocialProofText(event.target.value)}
              rows={2}
              className="mb-2 w-full rounded border border-[#2a3852] bg-[#0a0e1a] p-2"
              placeholder="Yesterday: 4-1 (+3.5u) | Last 7 Days: 18-9 (67% Win Rate)"
            />
            <button
              type="button"
              onClick={saveSocialProof}
              className="rounded bg-[#00c853] px-4 py-2 text-black"
            >
              Update Banner
            </button>
            {socialProofMessage ? <p className="mt-2 text-sm text-[#8b92a5]">{socialProofMessage}</p> : null}
          </div>

          <div className="rounded-lg border border-[#2a3852] bg-[#111829] p-4">
            <h2 className="mb-3 text-xl">System Prompt</h2>
            <label className="mb-2 block text-sm">
              Active Prompt
              <div className="mt-1 rounded border border-[#2a3852] bg-[#0a0e1a] p-2 text-xs text-[#8b92a5]">
                {activePrompt || "No active prompt loaded."}
              </div>
            </label>
            <label className="mb-3 block">
              Update Prompt
              <textarea
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                rows={6}
                className="mt-1 w-full rounded border border-[#2a3852] bg-[#0a0e1a] p-2"
              />
            </label>
            <button type="button" onClick={savePrompt} className="rounded bg-[#00c853] px-4 py-2 text-black">
              Save Prompt
            </button>
            {promptMessage ? <p className="mt-2 text-sm text-[#8b92a5]">{promptMessage}</p> : null}
            {promptHistory.length ? (
              <div className="mt-3">
                <h3 className="mb-2 font-semibold">Prompt History</h3>
                <div className="space-y-2">
                  {promptHistory.slice(0, 5).map((prompt) => (
                    <div key={prompt.id} className="rounded border border-[#2a3852] p-2 text-xs">
                      <div className="mb-1 text-[#8b92a5]">
                        v{prompt.version} {prompt.isActive ? "(active)" : ""}
                      </div>
                      <div className="whitespace-pre-wrap text-[#f5f5f3]">{prompt.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <section className="rounded-lg border border-[#2a3852] bg-[#111829] p-4">
            <h2 className="mb-3 text-xl">Geçmiş Yüklemeler</h2>
            <div className="space-y-2">
              {predictions.map((prediction) => (
                <div key={prediction.id} className="rounded border border-[#2a3852] p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="text-sm">
                      <strong>{prediction.date}</strong> {prediction.isNoEdgeDay ? "— No Edge" : ""}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => selectPrediction(prediction)}
                        className="rounded bg-[#00c853] px-2 py-1 text-black"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePrediction(prediction.id)}
                        className="rounded bg-[#ff3b3b] px-2 py-1 text-black"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-[#8b92a5]">
                    {prediction.teaserText.slice(0, 110)}{prediction.teaserText.length > 110 ? "..." : ""}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
