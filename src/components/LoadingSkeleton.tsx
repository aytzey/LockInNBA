"use client";

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-white/5 bg-[#111829] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-7 w-40 rounded bg-white/5" />
        <div className="h-5 w-16 rounded-full bg-white/5" />
      </div>
      <div className="mb-3 h-5 w-3/4 rounded bg-white/5" />
      <div className="mb-4 rounded-md border border-white/5 bg-black/10 p-4">
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-white/5" />
          <div className="h-4 w-5/6 rounded bg-white/5" />
          <div className="h-4 w-4/6 rounded bg-white/5" />
        </div>
      </div>
      <div className="h-12 w-full rounded-lg bg-white/5" />
    </div>
  );
}

export function GameSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-[#2a3852]/50 bg-[#101a2c] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-5 w-32 rounded bg-white/5" />
        <div className="h-5 w-16 rounded-full bg-white/5" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-white/5" />
        <div className="h-4 w-16 rounded bg-white/5" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="h-9 rounded bg-white/5" />
        <div className="h-9 rounded bg-white/5" />
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
