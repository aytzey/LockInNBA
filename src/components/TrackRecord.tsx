"use client";

import { useMemo, useState } from "react";
import {
  parseTrackRecordMarkdown,
  TRACK_RECORD_DISCLAIMER,
  TRACK_RECORD_VISIBLE_COUNT,
  type TrackRecordEntry,
} from "@/lib/track-record";

interface TrackRecordProps {
  markdown: string;
  className?: string;
  heading?: string;
  showHeading?: boolean;
  defaultExpanded?: boolean;
  emptyMessage?: string;
}

export default function TrackRecord({
  markdown,
  className = "",
  heading = "Our Track Record",
  showHeading = true,
  defaultExpanded = false,
  emptyMessage = "Track record will appear here once results are published.",
}: TrackRecordProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const record = useMemo(() => parseTrackRecordMarkdown(markdown), [markdown]);

  if (!record.summary && record.entries.length === 0) {
    return (
      <section className={className}>
        {showHeading ? (
          <div className="mb-3 space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--silver-gray)]">Transparency</p>
            <h2 className="heading text-[1.35rem] text-[color:var(--pure-white)] md:text-[1.8rem]">{heading}</h2>
          </div>
        ) : null}
        <div className="rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-4 py-5 text-sm text-[color:var(--silver-gray)]">
          {emptyMessage}
        </div>
      </section>
    );
  }

  const visibleEntries = expanded ? record.entries : record.entries.slice(0, TRACK_RECORD_VISIBLE_COUNT);
  const hasHiddenEntries = record.entries.length > TRACK_RECORD_VISIBLE_COUNT;

  return (
    <section className={className}>
      {showHeading ? (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--silver-gray)]">Transparency</p>
            <h2 className="heading text-[1.35rem] text-[color:var(--pure-white)] md:text-[1.8rem]">{heading}</h2>
          </div>
          {record.summary ? (
            <div className="rounded-full border border-[color:var(--money-green-line)] bg-[color:var(--money-green-soft)] px-3 py-1.5 text-[11px] text-[color:var(--money-green)]">
              {record.summary}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--panel)] shadow-[var(--shadow-card)]">
        {record.summary && !showHeading ? (
          <div className="border-b border-[color:var(--line)] bg-[color:var(--panel-soft)] px-4 py-3 text-sm text-[color:var(--money-green)]">
            {record.summary}
          </div>
        ) : null}

        <div className="space-y-2 px-4 py-4 md:px-5 md:py-5">
          {visibleEntries.map((entry) => (
            <TrackRecordRow key={entry.id} entry={entry} />
          ))}
        </div>

        <div className="border-t border-[color:var(--line)] px-4 py-3 md:px-5">
          {hasHiddenEntries ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="text-xs text-[color:var(--silver-gray)] transition hover:text-[color:var(--pure-white)]"
            >
              {expanded ? "Show less ▲" : "Show full record ▼"}
            </button>
          ) : null}

          <p className="mt-2 text-[10px] leading-4 text-[color:var(--silver-gray)]">
            {TRACK_RECORD_DISCLAIMER}
          </p>
        </div>
      </div>
    </section>
  );
}

function TrackRecordRow({ entry }: { entry: TrackRecordEntry }) {
  const displayLine = stripTrackRecordPnl(entry.line, entry.pnl);
  const tone =
    entry.outcome === "win"
      ? "text-[color:var(--money-green)]"
      : entry.outcome === "loss"
        ? "text-[color:var(--alert-red)]"
        : "text-[color:var(--silver-gray)]";

  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-3 py-3 md:grid-cols-[auto_1fr_auto] md:items-start">
      <span className={`mt-0.5 text-sm ${tone}`} aria-hidden="true">
        {entry.outcome === "win" ? "W" : entry.outcome === "loss" ? "L" : entry.outcome === "pass" ? "P" : "-"}
      </span>
      <div className="min-w-0 text-sm leading-6 text-[color:var(--pure-white)]">
        {entry.outcome === "pass" ? (
          <span className="italic text-[color:var(--silver-gray)]">{displayLine.replace(/\*\*/g, "")}</span>
        ) : (
          renderTrackRecordLine(displayLine, entry.outcome)
        )}
      </div>
      {entry.pnl ? (
        <div className={`mono mt-1 text-xs md:mt-0 md:text-right ${tone}`}>
          {entry.pnl}
        </div>
      ) : null}
    </div>
  );
}

function renderTrackRecordLine(line: string, outcome: TrackRecordEntry["outcome"]) {
  const boldSegments = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);

  return boldSegments.map((segment, segmentIndex) => {
    const isBold = segment.startsWith("**") && segment.endsWith("**");
    const cleanSegment = isBold ? segment.slice(2, -2) : segment;
    const pnlSegments = cleanSegment.split(/([+-]\d+(?:\.\d+)?u\b)/i).filter(Boolean);

    return pnlSegments.map((part, partIndex) => {
      const isPnl = /^[+-]\d+(?:\.\d+)?u$/i.test(part);
      const key = `${segmentIndex}-${partIndex}-${part}`;
      if (isPnl) {
        const pnlTone =
          outcome === "loss"
            ? "text-[color:var(--alert-red)]"
            : "text-[color:var(--money-green)]";
        return (
          <span key={key} className={`mono ${pnlTone}`}>
            {part}
          </span>
        );
      }

      if (isBold) {
        return (
          <strong key={key} className="font-semibold text-[color:var(--pure-white)]">
            {part}
          </strong>
        );
      }

      return <span key={key}>{part}</span>;
    });
  });
}

function stripTrackRecordPnl(line: string, pnl: string | null): string {
  if (!pnl) {
    return line;
  }

  return line.replace(new RegExp(`\\s*[·|]\\s*${escapeRegExp(pnl)}$`, "i"), "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
