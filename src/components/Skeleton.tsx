import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[var(--border-light)] opacity-60 ${className}`}
      {...props}
    />
  );
}

// Helpers

export function SkeletonCard() {
  return (
    <div className="glass-card flex flex-col gap-4 p-4 min-w-0 border border-[var(--border)]">
      <Skeleton className="h-3 w-28 bg-[var(--foreground-muted)]" />
      <Skeleton className="h-10 w-24 bg-[var(--foreground)]" />
      <Skeleton className="h-2 w-full mt-2" />
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="glass-card min-w-0 flex flex-col gap-4 p-4 border border-[var(--border)]">
      <div className="flex justify-between items-center pb-3 border-b border-[var(--border)]">
        <Skeleton className="h-4 w-40 bg-[var(--foreground-muted)]" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="flex flex-col gap-3 mt-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-[80%]" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-[90%]" />
      </div>
    </div>
  );
}

export function SkeletonChart({ height = 260 }: { height?: number }) {
  // Gera montantes aleatórios de "barras" pulsantes
  return (
    <div className="glass-card min-w-0 flex flex-col gap-4 p-4 border border-[var(--border)]" style={{ height }}>
      <Skeleton className="h-4 w-48 mb-2 bg-[var(--foreground-muted)]" />
      <div className="flex items-end gap-3 flex-1 h-full w-full pt-4">
        {[45, 65, 30, 78, 52, 40, 70, 35, 60, 48, 72, 55].map((h, i) => (
            <Skeleton 
              key={i} 
              className="w-full rounded-t-sm" 
              style={{ height: `${h}%` }} 
            />
        ))}
      </div>
    </div>
  );
}
