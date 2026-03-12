"use client";

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#2a3852]/40 bg-gradient-to-b from-[#111829] to-[#0d1422] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="skeleton-shimmer h-7 w-40 rounded-lg" />
        <div className="skeleton-shimmer h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton-shimmer mb-3 h-5 w-3/4 rounded-lg" />
      <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
        <div className="space-y-2.5">
          <div className="skeleton-shimmer h-4 w-full rounded" />
          <div className="skeleton-shimmer h-4 w-5/6 rounded" />
          <div className="skeleton-shimmer h-4 w-4/6 rounded" />
        </div>
      </div>
      <div className="skeleton-shimmer mt-4 h-12 w-full rounded-xl" />
    </div>
  );
}

export function GameSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#2a3852]/40 bg-gradient-to-br from-[#111d30] to-[#0d1422] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="skeleton-shimmer h-5 w-32 rounded-lg" />
        <div className="skeleton-shimmer h-5 w-16 rounded-full" />
      </div>
      <div className="mb-3 flex items-center gap-3">
        <div className="skeleton-shimmer h-3.5 w-20 rounded" />
        <div className="skeleton-shimmer h-3.5 w-14 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="skeleton-shimmer h-10 rounded-lg" />
        <div className="skeleton-shimmer h-10 rounded-lg" />
      </div>
    </div>
  );
}

export function GameListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <GameSkeleton key={i} />
      ))}
    </div>
  );
}
