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
              className="w-full rounded-t-sm motion-reduce:animate-none"
              style={{ height: `${h}%` }}
            />
        ))}
      </div>
    </div>
  );
}

export function TableSkeletonRows({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr
          key={rIdx}
          className="border-b border-border/40 hover:bg-muted/10 transition-colors"
          aria-hidden="true"
        >
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-2.5 px-3">
              <Skeleton className="h-4 w-full rounded bg-muted/40 motion-reduce:animate-none" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function TableSkeletonCard({
  rows = 8,
  columns = 6,
  title,
}: {
  rows?: number;
  columns?: number;
  title?: string;
}) {
  return (
    <div
      className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4"
      aria-busy="true"
      aria-label="Carregando tabela..."
    >
      <div className="flex justify-between items-center pb-3 border-b border-border">
        {title ? (
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        ) : (
          <Skeleton className="h-5 w-48 bg-muted/40 motion-reduce:animate-none" />
        )}
        <Skeleton className="h-8 w-28 rounded-lg bg-muted/40 motion-reduce:animate-none" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="py-2.5 px-3">
                  <Skeleton className="h-3.5 w-16 bg-muted/40 motion-reduce:animate-none" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <TableSkeletonRows rows={rows} columns={columns} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RpsTableSkeleton({
  managersCount = 4,
}: {
  managersCount?: number;
}) {
  return (
    <div
      className="glass-card rps-card p-4 rounded-xl border border-border space-y-4"
      aria-busy="true"
      aria-label="Carregando Projeções da RPS..."
    >
      <div className="flex justify-between items-center pb-3 border-b border-border">
        <Skeleton className="h-5 w-64 bg-muted/40 motion-reduce:animate-none" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg bg-muted/40 motion-reduce:animate-none" />
          <Skeleton className="h-8 w-24 rounded-lg bg-muted/40 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table rps-table w-full text-xs">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="py-2.5 px-3 text-left w-48">
                <Skeleton className="h-4 w-28 bg-muted/40 motion-reduce:animate-none" />
              </th>
              <th className="py-2.5 px-3 text-center w-16">
                <Skeleton className="h-4 w-10 mx-auto bg-muted/40 motion-reduce:animate-none" />
              </th>
              <th className="py-2.5 px-3 text-right w-24">
                <Skeleton className="h-4 w-16 ml-auto bg-muted/40 motion-reduce:animate-none" />
              </th>
              <th className="py-2.5 px-3 text-right w-24">
                <Skeleton className="h-4 w-16 ml-auto bg-muted/40 motion-reduce:animate-none" />
              </th>
              <th className="py-2.5 px-3 text-right w-24">
                <Skeleton className="h-4 w-16 ml-auto bg-muted/40 motion-reduce:animate-none" />
              </th>
              <th className="py-2.5 px-3 text-right w-20">
                <Skeleton className="h-4 w-14 ml-auto bg-muted/40 motion-reduce:animate-none" />
              </th>
              <th className="py-2.5 px-3 text-right w-20">
                <Skeleton className="h-4 w-14 ml-auto bg-muted/40 motion-reduce:animate-none" />
              </th>
              <th className="py-2.5 px-3 text-right w-20">
                <Skeleton className="h-4 w-14 ml-auto bg-muted/40 motion-reduce:animate-none" />
              </th>
              <th className="py-2.5 px-3 text-right w-20">
                <Skeleton className="h-4 w-14 ml-auto bg-muted/40 motion-reduce:animate-none" />
              </th>
              <th className="py-2.5 px-3 text-right w-20">
                <Skeleton className="h-4 w-14 ml-auto bg-muted/40 motion-reduce:animate-none" />
              </th>
              <th className="py-2.5 px-3 text-right w-20">
                <Skeleton className="h-4 w-14 ml-auto bg-muted/40 motion-reduce:animate-none" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: managersCount }).map((_, mIdx) => (
              <React.Fragment key={mIdx}>
                {/* Linha Cabeçalho Gerente */}
                <tr className="bg-muted/30 font-bold border-t-2 border-border/80">
                  <td className="py-2.5 px-3">
                    <Skeleton className="h-4 w-36 bg-accent-gold/30 motion-reduce:animate-none" />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Skeleton className="h-4 w-8 mx-auto bg-muted/40 motion-reduce:animate-none" />
                  </td>
                  {Array.from({ length: 9 }).map((_, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-3">
                      <Skeleton className="h-4 w-full bg-muted/40 motion-reduce:animate-none" />
                    </td>
                  ))}
                </tr>
                {/* Linhas de KPIs e Clientes */}
                <TableSkeletonRows rows={3} columns={11} />
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
