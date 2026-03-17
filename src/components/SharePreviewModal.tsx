"use client";

import { motion } from "framer-motion";

interface SharePreviewModalProps {
  isOpen: boolean;
  status: "success" | "error";
  mode: "daily" | "chat";
  imageUrl: string | null;
  errorMessage: string;
  canCopyImage: boolean;
  isCopying: boolean;
  onClose: () => void;
  onRetry: () => void;
  onDownload: () => void;
  onCopyImage: () => void;
  onShareToX: () => void;
}

export default function SharePreviewModal({
  isOpen,
  status,
  mode,
  imageUrl,
  errorMessage,
  canCopyImage,
  isCopying,
  onClose,
  onRetry,
  onDownload,
  onCopyImage,
  onShareToX,
}: SharePreviewModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-[color:var(--line)] bg-[color:var(--panel-strong)] shadow-[0_32px_90px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--silver-gray)]">
              {status === "success" ? "Share Card Ready" : "Share Card Error"}
            </p>
            <h2 className="heading mt-1 text-xl text-[color:var(--pure-white)]">
              {status === "success"
                ? mode === "daily"
                  ? "Daily edge export"
                  : "Match insight export"
                : "Share export failed"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--line)] text-[color:var(--silver-gray)] transition hover:border-[color:var(--line-strong)] hover:text-[color:var(--pure-white)]"
            aria-label="Close share preview"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {status === "success" && imageUrl ? (
          <div className="space-y-4 px-5 py-5">
            <div className="overflow-hidden rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Generated LOCKIN share card preview"
                className="h-auto w-full rounded-[1rem] border border-[color:var(--line)]"
              />
            </div>

            <p className="text-sm text-[color:var(--silver-gray)]">
              The PNG has already been downloaded once. You can download it again, copy the image directly, or open an X post with the caption prefilled.
            </p>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onDownload} className="primary-button justify-center">
                Download
              </button>
              <button
                type="button"
                onClick={onCopyImage}
                disabled={!canCopyImage || isCopying}
                className="secondary-button justify-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCopying ? "Copying..." : "Copy Image"}
              </button>
              <button type="button" onClick={onShareToX} className="secondary-button justify-center">
                Share to X
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-6">
            <div className="rounded-[1.25rem] border border-[color:var(--alert-red-line)] bg-[color:var(--alert-red-soft)] px-4 py-4 text-sm text-[color:var(--alert-red)]">
              {errorMessage || "Share card couldn't be generated. Please try again."}
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onRetry} className="primary-button justify-center">
                Retry
              </button>
              <button type="button" onClick={onClose} className="secondary-button justify-center">
                Close
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
