import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getEngineState } from "@/lib/engine";
import { getCatalog, getTrackRecord } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System status",
  description:
    "Live status of the AssetFrame engine and the public track record — whether the engine is publishing, when the last edition shipped, and how the scored calls stand.",
  alternates: { canonical: "/status" },
};

// DaisyUI badge + status dot (on-brand via the custom theme): success when running, warning otherwise.
function StatusPill({ online, paused }: { online: boolean; paused: boolean }) {
  const [label, badge, dot] = paused
    ? ["Paused", "daisy-badge-warning", "daisy-status-warning"]
    : online
      ? ["Operational", "daisy-badge-success", "daisy-status-success"]
      : ["Catching up", "daisy-badge-warning", "daisy-status-warning"];
  return (
    <span className={`daisy-badge daisy-badge-soft ${badge} daisy-badge-lg gap-2 font-bold`}>
      <span className={`daisy-status ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <CardContent className="px-0">
        <div className="text-2xl font-bold text-navy">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export default async function StatusPage() {
  const [state, catalog, track] = await Promise.all([getEngineState(), getCatalog(), getTrackRecord()]);
  const latest = [...catalog].sort((a, b) => b.date.localeCompare(a.date))[0];
  const stats = track.stats;
  const rate = typeof stats.hitRate === "number" ? `${stats.hitRate.toFixed(1)}%` : "—";
  // This page is force-dynamic and reads the engine's LIVE status on every load, so "last checked" is
  // now (the old "last heartbeat" read stale once the poller stopped writing a heartbeat — online now
  // comes from the engine's own liveness check, not a heartbeat timestamp).
  const checkedAt = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;

  return (
    <>
      <Hero title="System status" tag="The engine, live — and the record, in the open." />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3" data-animate="up">
          <div>
            <div className="text-sm font-semibold text-muted-foreground">Engine</div>
            <div className="mt-1"><StatusPill online={state.online} paused={state.automationPaused} /></div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            Last checked<br />
            <span className="font-mono text-foreground">{checkedAt}</span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground" data-animate="up">
          {state.automationPaused
            ? "Automatic publishing is paused. New editions resume when it's switched back on."
            : state.online
              ? "The engine is running and publishing on schedule. Each new edition is graded against the actual market move once its window closes."
              : "The engine isn't running right now — it may be restarting. Already-published editions and the track record below are unaffected."}
        </p>

        <h2 className="mt-10 mb-4 text-xl font-bold text-navy" data-animate="up">Latest publication</h2>
        <div className="grid gap-4 sm:grid-cols-2" data-animate="up">
          <Stat label="Most recent edition" value={latest ? latest.date : "—"} />
          <Stat label="Instrument" value={latest ? latest.instrument : "—"} />
        </div>

        <h2 className="mt-10 mb-4 text-xl font-bold text-navy" data-animate="up">Track record</h2>
        <div className="grid gap-4 sm:grid-cols-3" data-animate="up">
          <Stat label="Reports scored" value={String(stats.reportsScored)} />
          <Stat label="Predictions graded" value={String(stats.predictionsGraded)} />
          <Stat label="Hit rate" value={rate} />
        </div>

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground" data-animate="up">
          Every call is recorded before the session and graded against the real market move afterwards
          — a public record that is never edited. The full history, win and loss, is on the
          track-record page.
        </p>

        <div className="mt-8 flex flex-wrap gap-3" data-animate="up">
          <Button asChild>
            <Link href="/track-record">See the full track record</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reports">Browse reports</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
