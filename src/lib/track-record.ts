export const TRACK_RECORD_VISIBLE_COUNT = 6;
export const TRACK_RECORD_DISCLAIMER =
  "Results tracked since Mar 8, 2026. Past performance does not guarantee future results. All results based on published picks.";

export interface TrackRecordEntry {
  id: string;
  line: string;
  outcome: "win" | "loss" | "pass" | "neutral";
  pnl: string | null;
}

export interface ParsedTrackRecord {
  summary: string | null;
  entries: TrackRecordEntry[];
}

export function normalizeTrackRecordMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function extractTrackRecordSummary(markdown: string): string | null {
  const normalized = normalizeTrackRecordMarkdown(markdown);
  if (!normalized) {
    return null;
  }

  const summaryLine = normalized
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("### "));

  if (!summaryLine) {
    return null;
  }

  const summary = summaryLine.replace(/^###\s*/, "").trim();
  return summary || null;
}

export function parseTrackRecordMarkdown(markdown: string): ParsedTrackRecord {
  const normalized = normalizeTrackRecordMarkdown(markdown);
  if (!normalized) {
    return { summary: null, entries: [] };
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const summary = extractTrackRecordSummary(normalized);
  const entryLines = lines.filter((line) => !line.startsWith("### "));

  return {
    summary,
    entries: entryLines.map((line, index) => ({
      id: `${index}-${line}`,
      line,
      outcome: inferTrackRecordOutcome(line),
      pnl: extractTrackRecordPnl(line),
    })),
  };
}

function inferTrackRecordOutcome(line: string): TrackRecordEntry["outcome"] {
  if (/\bPASS\b/i.test(line)) {
    return "pass";
  }

  if (/(^|·)\s*W\b/i.test(line)) {
    return "win";
  }

  if (/(^|·)\s*L\b/i.test(line)) {
    return "loss";
  }

  return "neutral";
}

function extractTrackRecordPnl(line: string): string | null {
  const pnlMatch = line.match(/([+-]\d+(?:\.\d+)?)u\b/i);
  return pnlMatch ? `${pnlMatch[1]}u` : null;
}
