"use client";
import type { ScheduleRow } from "@/lib/engine-box";
import Paginated from "@/components/Paginated";

// "Reports waiting for their next generation" — every enabled asset in the universe with its cadence
// and the next UTC slot it's due (computed on the box: calendar_rules.next_due_at). due-now first.
function fmtNext(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.replace("T", " ").slice(0, 16)} UTC`;
}

export function ScheduleView({ rows }: { rows: ScheduleRow[] }) {
  return (
    <Paginated
      items={rows}
      noun="assets"
      containerClassName="divide-y divide-line border-t border-line"
      emptyChildren={
        <p className="mx-6 mb-2 rounded-xl border border-dashed border-line bg-tile/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No enabled assets — add some in the asset universe below, or the box isn&apos;t reporting a schedule yet.
        </p>
      }
      keyOf={(r) => r.id}
      render={(r) => (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {r.dueNow ? (
              <span className="shrink-0 rounded-full bg-[#fff7e6] px-2.5 py-0.5 text-[11px] font-bold text-[#9a6700]">due now</span>
            ) : (
              <span className="shrink-0 rounded-full bg-tile px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">scheduled</span>
            )}
            <span className="truncate font-semibold uppercase tracking-wide text-navy">{r.id}</span>
            <span className="text-[11px] text-muted-foreground">{r.assetClass || "—"} · {r.cadence || "—"}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            next gen: <b className="text-navy">{fmtNext(r.nextDueAt)}</b>
          </span>
        </div>
      )}
    />
  );
}
