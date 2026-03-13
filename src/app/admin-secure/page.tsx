"use client";

import { useEffect, useState } from "react";
import MarkdownContent from "@/components/MarkdownContent";

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
  noEdgeMessage: string;
  headerRightText: string;
  footerDisclaimer: string;
};

const ADMIN_TOKEN_KEY = "lockin_admin_token";
const DEFAULT_SITE_COPY: SiteCopy = {
  dailyCtaText: "Unlock Tonight's Edge — $5",
  noEdgeMessage: "We passed on 90% of this week's games. We only bet when the math screams.",
  headerRightText: "",
  footerDisclaimer:
    "For entertainment purposes only. LOCKIN does not accept wagers or guarantee outcomes. If you or someone you know has a gambling problem, call 1-800-GAMBLER.",
};

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

  const [siteCopy, setSiteCopy] = useState<SiteCopy>(DEFAULT_SITE_COPY);
  const [siteCopyMessage, setSiteCopyMessage] = useState("");

  const [activePrompt, setActivePrompt] = useState("");
  const [promptHistory, setPromptHistory] = useState<SystemPrompt[]>([]);
  const [promptText, setPromptText] = useState("");
  const [promptMessage, setPromptMessage] = useState("");

  const [activeTab, setActiveTab] = useState<"predictions" | "social" | "copy" | "prompt">("predictions");

  async function bootstrapAdmin(tokenValue: string | null) {
    if (!tokenValue) return;

    try {
      const [predictionsResponse, proofResponse, promptResponse, siteCopyResponse] = await Promise.all([
        fetch("/api/admin/predictions", { headers: addAuthHeader(tokenValue) }),
        fetch("/api/admin/social-proof-banner", { headers: addAuthHeader(tokenValue) }),
        fetch("/api/admin/system-prompt", { headers: addAuthHeader(tokenValue) }),
        fetch("/api/admin/site-copy", { headers: addAuthHeader(tokenValue) }),
      ]);

      if ([predictionsResponse, proofResponse, promptResponse, siteCopyResponse].some((response) => response.status === 401)) {
        window.localStorage.removeItem(ADMIN_TOKEN_KEY);
        setToken(null);
        setChecking(false);
        return;
      }

      const [predictionsBody, proofBody, promptBody, siteCopyBody] = await Promise.all([
        predictionsResponse.json(),
        proofResponse.json(),
        promptResponse.json(),
        siteCopyResponse.json(),
      ]);

      setPredictions(predictionsBody.predictions || []);
      setSocialProofText(proofBody.banner || "");
      setActivePrompt(promptBody.active?.content || "");
      setPromptHistory(promptBody.history || []);
      setSiteCopy({
        dailyCtaText: siteCopyBody.siteCopy?.dailyCtaText || DEFAULT_SITE_COPY.dailyCtaText,
        noEdgeMessage: siteCopyBody.siteCopy?.noEdgeMessage || DEFAULT_SITE_COPY.noEdgeMessage,
        headerRightText: siteCopyBody.siteCopy?.headerRightText || DEFAULT_SITE_COPY.headerRightText,
        footerDisclaimer: siteCopyBody.siteCopy?.footerDisclaimer || DEFAULT_SITE_COPY.footerDisclaimer,
      });
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
      void bootstrapAdmin(savedToken).catch(() => setChecking(false));
      return;
    }

    setChecking(false);
  }, []);

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
        noEdgeMessage: data.siteCopy?.noEdgeMessage || DEFAULT_SITE_COPY.noEdgeMessage,
        headerRightText: data.siteCopy?.headerRightText || DEFAULT_SITE_COPY.headerRightText,
        footerDisclaimer: data.siteCopy?.footerDisclaimer || DEFAULT_SITE_COPY.footerDisclaimer,
      });
      setSiteCopyMessage("Site copy updated.");
    } catch {
      setSiteCopyMessage("Update failed due to network error.");
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
            onClick={() => {
              window.localStorage.removeItem(ADMIN_TOKEN_KEY);
              setToken(null);
            }}
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
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
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
                  <p className="admin-help">Shown above the blurred card. Keep it to one or two sharp lines.</p>
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
                Leave this empty to fall back to the default weekly performance copy. On No Edge days the public page auto-prefixes this with the bankroll-protection message.
              </p>

              <div>
                <label className="input-label" htmlFor="social-proof">Banner text</label>
                <textarea
                  id="social-proof"
                  value={socialProofText}
                  onChange={(event) => setSocialProofText(event.target.value)}
                  rows={3}
                  className="input-field mt-2 resize-none"
                />
              </div>

              <div className="social-banner">
                <div className="social-banner__edge social-banner__edge--left" />
                <div className="social-banner__edge social-banner__edge--right" />
                <div className="social-banner__track">
                  <div className="social-banner__marquee">
                    <span className="social-banner__item">
                      <span className="social-banner__dot" />
                      <span className="mono">{socialProofText || "This Week: 5-0 (100%) | +19.3u ROI"}</span>
                    </span>
                  </div>
                </div>
              </div>

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
                <label className="input-label" htmlFor="copy-header">Header right text</label>
                <input
                  id="copy-header"
                  value={siteCopy.headerRightText}
                  onChange={(event) => setSiteCopy((current) => ({ ...current, headerRightText: event.target.value }))}
                  className="input-field mt-2"
                  placeholder="5-0 This Week"
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
