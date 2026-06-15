import { Skeleton } from "@/components/ui/skeleton";

export function HeroSkeleton() {
  return (
    <section className="bg-navy">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-5 sm:py-14">
        <Skeleton className="h-9 w-56 bg-white/15" />
        <Skeleton className="mt-3 h-5 w-80 max-w-[80%] bg-white/10" />
      </div>
    </section>
  );
}

export function StatsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-white p-4">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between border-b border-line p-3 last:border-0">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <StatsSkeleton />
        <div className="mt-6">
          <RowsSkeleton />
        </div>
      </div>
    </>
  );
}

export function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-9 w-64" />
      <Skeleton className="mt-2 h-4 w-40" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-32 w-full rounded-xl" />
      <Skeleton className="mt-4 h-40 w-full rounded-xl" />
    </div>
  );
}

// A single report card placeholder (image / title / badges / bias / footer) — matches ReportCard.
function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-white">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-28" />
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-4 w-32" />
        <Skeleton className="mt-3 h-3 w-44" />
      </div>
    </div>
  );
}

function FilterBarSkeleton({ pills = 5 }: { pills?: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Skeleton className="h-9 w-full sm:max-w-xs" />
      {Array.from({ length: pills }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full sm:w-[150px]" />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex gap-4 border-b border-line bg-tile p-3">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-4 flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-line p-3 last:border-0">
          {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} className="h-4 flex-1" />)}
        </div>
      ))}
    </div>
  );
}

// Reports index: filter bar + a responsive grid of report cards.
export function ReportsSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5">
        <FilterBarSkeleton pills={5} />
        <Skeleton className="mt-4 h-4 w-28" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    </>
  );
}

// Track record: stat headline + the registered/scored breakdown + open-calls list + scored table.
export function TrackRecordSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <StatsSkeleton n={4} />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <Skeleton className="mt-5 h-12 w-full rounded-xl" />
        <Skeleton className="mt-8 h-6 w-44" />
        <div className="mt-3"><FilterBarSkeleton pills={3} /></div>
        <div className="mt-3"><RowsSkeleton rows={6} /></div>
        <Skeleton className="mt-8 h-6 w-40" />
        <div className="mt-3"><TableSkeleton rows={5} cols={6} /></div>
      </div>
    </>
  );
}

// Account: hero + a couple of summary cards.
export function AccountSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <div className="mx-auto max-w-2xl px-5 py-8">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="mt-4 h-28 w-full rounded-xl" />
      </div>
    </>
  );
}
