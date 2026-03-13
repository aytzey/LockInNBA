"use client";

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-5 md:rounded-[1.8rem]">
      <div className="mb-4 flex items-center justify-between">
        <div className="skeleton-shimmer h-7 w-40 rounded-lg" />
        <div className="skeleton-shimmer h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton-shimmer mb-3 h-5 w-3/4 rounded-lg" />
      <div className="rounded-[1.2rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] p-4">
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

export function GameSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="overflow-hidden rounded-[1.6rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-4 opacity-0 animate-[fadeIn_400ms_ease_forwards] md:rounded-[1.8rem] md:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="skeleton-shimmer h-8 w-8 rounded-full md:h-10 md:w-10" />
            <div className="skeleton-shimmer h-8 w-8 rounded-full md:h-10 md:w-10" />
          </div>
          <div className="skeleton-shimmer h-5 w-28 rounded-lg md:w-36" />
        </div>
        <div className="skeleton-shimmer h-5 w-16 rounded-full md:w-20" />
      </div>
      <div className="mb-3 flex items-center gap-3">
        <div className="skeleton-shimmer h-3.5 w-20 rounded" />
        <div className="skeleton-shimmer h-3.5 w-14 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <div className="skeleton-shimmer h-12 rounded-lg md:h-14 md:rounded-xl" />
        <div className="skeleton-shimmer h-12 rounded-lg md:h-14 md:rounded-xl" />
      </div>
    </div>
  );
}

export function GameListSkeleton() {
  return (
    <div className="space-y-3 md:space-y-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <GameSkeleton key={i} delay={i * 80} />
      ))}
    </div>
  );
}
