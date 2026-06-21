"use client";
import { useSyncExternalStore } from "react";
import { BookOpen, ChevronDown } from "lucide-react";

// The operator manual — the spine of the admin page. Open by default on a first visit, then
// remembers if you collapse it (localStorage), so it greets a new admin but stays out of the way
// after. The first-run checklist deep-links to the numbered sections below (#sec-assets /
// #sec-generate / #sec-approve), so reading a step and doing it are one click apart.
//
// Content is hand-rendered JSX (no markdown dependency) and is kept ACCURATE to the real controls:
// Set config has exactly 3 keys; Grant/Revoke Pro is comp-only (paid subs → Clerk dashboard); the
// approval toggle is global (per-asset policy lives in Add/Edit); cancellation is co-operative.

const KEY = "af-admin-manual-collapsed";

// Tiny localStorage-backed store read via useSyncExternalStore — the server snapshot is "open",
// so a first visit (and SSR) renders expanded; the client re-reads the remembered preference after
// hydration without a mismatch and without a setState-in-effect. The `storage` event keeps it in
// sync across tabs; an in-tab toggle notifies local listeners directly.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function isCollapsed() {
  return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
}
function setCollapsed(v: boolean) {
  localStorage.setItem(KEY, v ? "1" : "0");
  listeners.forEach((l) => l());
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 text-sm font-bold tracking-tight text-navy first:mt-0">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}
function B({ children }: { children: React.ReactNode }) {
  return <b className="font-semibold text-navy">{children}</b>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">{children}</ul>;
}
function Jump({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="font-semibold text-navy underline decoration-navy/30 underline-offset-2 hover:decoration-navy">
      {children}
    </a>
  );
}

export default function OperatorManual() {
  // Open by default on a first visit (server snapshot = not collapsed); remembers if you collapse it.
  const open = !useSyncExternalStore(subscribe, isCollapsed, () => false);
  const toggle = () => setCollapsed(open);

  return (
    <div className="mt-4 overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <BookOpen className="size-4 shrink-0 text-navy" />
          <span className="min-w-0">
            <span className="font-heading text-base font-medium leading-snug text-navy">Operator manual — read me first</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              How this whole page works, a first-run checklist, and what to do when something breaks.
            </span>
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-line px-4 py-4 sm:px-6">
          <P>
            You are the only admin. This page is the control plane for an autonomous <B>engine</B> that
            writes market reports. You never run anything yourself — you <B>enqueue commands</B> here, and
            a cloud box picks them up on its next check-in (about every 30 seconds). Read this once, then
            collapse it and reopen it whenever a control confuses you or something breaks.
          </P>

          <H>The mental model (read once)</H>
          <UL>
            <li>
              <B>Two halves, no shared code.</B> The <B>engine</B> is Python on a cloud box (Oracle Cloud)
              that <i>writes</i>. This web admin only <i>reads</i> status and <i>enqueues</i> work. They
              never talk directly — the box has <B>no inbound ports</B>.
            </li>
            <li>
              <B>How they coordinate:</B> you write a row in the database (Neon); the box polls it (~30s),
              does the work, writes results back; this page reads those results. Nothing is instant — expect
              results within ~30s in the logs.
            </li>
            <li>
              <B>The daily flow:</B> every day at <B>05:00 UTC</B> (unless automation is paused) the engine
              generates each <B>due</B> asset: market data → memory pack → ledger context (per-instrument
              learning) → AI brief (written, then adversarially critiqued) → deterministic
              prices/predictions/<B>confidence</B> → render + QA → publish → sync.
            </li>
            <li>
              <B>The approval gate:</B> new editions land <B>hidden</B>. Nothing is public until <i>you</i>{" "}
              Approve it — unless that asset&rsquo;s publish policy is set to auto.
            </li>
            <li>
              <B>The track record:</B> a prediction is graded only <B>after its window closes</B> (BTC ~24h).
              Scoring appends to an <B>append-only outcome ledger</B> — the public track record. The engine{" "}
              <B>learns per instrument</B>: an asset&rsquo;s confidence reflects <i>its own</i> realised hit
              rate. You never hand-edit the ledger.
            </li>
            <li>
              <B>Backdate is the shortcut:</B> generate a report dated to the <i>past</i> so its window is
              already closed, then score it immediately — that&rsquo;s how you seed/test the track record
              without waiting ~24h.
            </li>
          </UL>

          <H>First-run checklist (your first hour)</H>
          <P>Do these in order. Each step maps to a numbered section below.</P>
          <ol className="mt-2 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <B>0 · Check the box is alive.</B> The status bar at the top should read <B>Online</B> with a
              recent <B>Last check-in</B> and <B>Automation: Active</B>. If it says Offline, see
              Troubleshooting first — nothing runs until it reconnects.
            </li>
            <li>
              <B>1 · Confirm your asset universe.</B> In <Jump href="#sec-assets">1 · Asset universe</Jump>,
              make sure at least one instrument (e.g. <B>BTC</B>) is <B>Enabled</B>. If nothing is enabled,
              the 05:00 run generates nothing and &ldquo;All due&rdquo; silently does nothing. Leave{" "}
              <B>Need approval</B> on while learning (recommended). Click <B>Check schedule</B> to fill the{" "}
              <B>Scheduled</B> column.
            </li>
            <li>
              <B>2 · Generate your first report.</B> In{" "}
              <Jump href="#sec-generate">2 · Generate, backdate &amp; score</Jump>, pick <B>All due</B> or{" "}
              <B>Pick assets</B>, then <B>Queue run</B>. Watch the <B>Generation queue</B> for{" "}
              queued → running → done. Takes a few minutes; the box must be Online.
            </li>
            <li>
              <B>3 · Seed the track record with a backdated run.</B> Still in section 2, set <B>Backdate</B>
              to a UTC time a few days ago (~3 days back is safe for crypto so the ~24h window is well
              closed) and <B>Queue backdated run</B>.
            </li>
            <li>
              <B>4 · Score it.</B> Click <B>Score now</B> in section 2. The engine grades any closed windows
              into the ledger — your track record just grew. Repeat 3–4 with different backdate times to
              build a real history before launch.
            </li>
            <li>
              <B>5 · Approve to publish.</B> Finished runs land hidden in{" "}
              <Jump href="#sec-approve">3 · Approve to publish</Jump>. <B>Preview</B> each one, then{" "}
              <B>Approve</B> to push it live. (Approving and scoring are independent — either order is fine.)
            </li>
          </ol>
          <P>
            That&rsquo;s the whole loop: <B>enable → generate → backdate → score → approve → watch the record grow.</B>
          </P>

          <H>Daily operations (after setup)</H>
          <UL>
            <li>
              <B>Leave automation Active.</B> The 05:00 UTC batch generates every due asset automatically.
              Pausing stops only the <i>automatic</i> batch — manual <B>Queue run</B> still works while paused.
            </li>
            <li><B>Each morning:</B> glance at the status bar (Online? recent check-in?), then clear any <B>Pending approval</B> editions (Preview → Approve).</li>
            <li><B>While seeding:</B> click <B>Score now</B> to grade windows that closed overnight. Once live, the engine scores closed windows on its own.</li>
            <li><B>Unpublish a live edition:</B> in the editions browser, toggle it to <B>Hidden</B>. The R2 files stay, so it can be restored.</li>
          </UL>

          <H>Backdate then Score (worked example)</H>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li><Jump href="#sec-generate">2 · Generate</Jump> → <B>Pick assets</B> → your instrument (or <B>All due</B>).</li>
            <li>Set <B>Backdate</B> to ~today minus 3 days (UTC). The report is generated as if it were that moment, so its window has already elapsed.</li>
            <li><B>Queue backdated run</B> and wait for <i>done</i> in the queue.</li>
            <li><B>Score now</B> — the closed window is graded into the append-only ledger.</li>
            <li>(Optional) <B>Approve</B> the hidden edition in section 3 if you want it public too.</li>
          </ol>
          <P>
            Backdating is the supported way to grow/test the ledger — it doesn&rsquo;t corrupt anything; the
            ledger stays append-only and an incomplete window is never scored. Repeat with several timestamps
            to build a multi-day record quickly.
          </P>

          <H>Control reference — every button</H>
          <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Ref title="Status bar">
              <li><B>Online / Offline + Last check-in</B> — the box&rsquo;s heartbeat. Offline means runs won&rsquo;t execute until it&rsquo;s back.</li>
              <li><B>Automation: Active / Paused</B> + <B>Pause/Resume</B> — whether the 05:00 UTC batch fires. Manual runs still work while paused.</li>
              <li><B>Running: &lt;id&gt;</B> — a run is in progress right now.</li>
            </Ref>
            <Ref title="1 · Asset universe">
              <li><B>New reports: Need approval / Auto-publish / Mixed</B> + toggle — sets <B>every</B> asset&rsquo;s publish policy at once. &ldquo;Mixed&rdquo; means assets disagree; set a single asset&rsquo;s policy in its Add/Edit form.</li>
              <li><B>Check schedule</B> — a safe dry-run that computes which assets are <B>Due now</B>.</li>
              <li><B>+ Add asset / Edit</B> — define an instrument; validated before it syncs, so a bad entry can&rsquo;t break generation.</li>
              <li><B>Enabled / Disabled</B> — include/exclude from the daily run. At least one must be enabled.</li>
            </Ref>
            <Ref title="2 · Generate, backdate &amp; score">
              <li><B>All due</B> — queue a run for every instrument the engine considers due.</li>
              <li><B>Pick assets</B> — hand-pick from the enabled universe (they generate in parallel).</li>
              <li><B>Backdate (as-of)</B> — generate as if it were a past UTC time so the window is already closed. Blank = run for now.</li>
              <li><B>Score now</B> — grades closed prediction windows into the ledger; generates no new reports.</li>
            </Ref>
            <Ref title="3 · Approve to publish">
              <li><B>Preview / PDF</B> — opens the hidden edition&rsquo;s reader page / free PDF in a new tab.</li>
              <li><B>Approve</B> — publishes the hidden edition to the public site, sitemap and reader.</li>
              <li><B>Editions browser</B> — search published editions; toggle <B>Hidden</B> to unpublish (files stay in R2; restorable).</li>
            </Ref>
            <Ref title="Operate the box (no data loss)">
              <li><B>Re-run publish</B> — re-runs export → R2 → Neon <i>without</i> regenerating. Fixes a generated-but-unpublished run.</li>
              <li><B>Fetch logs</B> — pulls ~200 recent poller lines into the Box command log.</li>
              <li><B>Service check</B> — pings Neon, R2 and Upstash from the box.</li>
              <li><B>Clear wake flag</B> — clears a stuck wake nudge.</li>
              <li><B>Pull + restart</B> — deploy latest code + deps, then restart. <B>Restart poller</B> — bounce the process (picks up config).</li>
              <li><B>Set config</B> — writes ONE allow-listed key: <code className="text-[11px]">ASSETFRAME_AUTHOR_BRIEFS</code>, <code className="text-[11px]">ADVISOR_DATA_PROVIDER</code>, <code className="text-[11px]">ASSETFRAME_RUN_TIMEOUT</code> (integer 60–86400), or <code className="text-[11px]">ASSETFRAME_BRIEF_MODEL</code> (the Claude model that writes briefs — e.g. <code className="text-[11px]">claude-sonnet-4-6</code> for value, <code className="text-[11px]">claude-haiku-4-5-20251001</code> for cheapest, <code className="text-[11px]">claude-opus-4-8</code> for best). Never secrets. Applies on the next Restart.</li>
            </Ref>
            <Ref title="Danger zone (irreversible)" danger>
              <li><B>Reset ledger</B> — empties the outcome ledger (the track-record source). Ledger only.</li>
              <li><B>Clear reports</B> — wipes the box&rsquo;s working dirs. Ledger untouched.</li>
              <li><B>Clear R2 files</B> — deletes report files from R2 (need re-publishing).</li>
              <li><B>Clear catalog (Neon)</B> — deletes editions + scored results from the public catalog.</li>
              <li><B>Full reset (all four)</B> — does all of the above in a safe order (Neon first; stops if that fails, so no orphans). Use only for a clean start before launch.</li>
            </Ref>
          </div>

          <H>Troubleshooting</H>
          <div className="mt-2 space-y-2.5">
            <Fix symptom="Box is Offline (status red).">
              Runs won&rsquo;t execute until it checks back in. Give it a minute (a blip self-heals) →{" "}
              <B>Restart poller</B> (systemd relaunches it in seconds) → still offline,{" "}
              <B>Pull + restart</B> → confirm with <B>Service check</B> and a fresh check-in.
            </Fix>
            <Fix symptom="A run is stuck in running / nothing is queuing.">
              Confirm Online + recent check-in first. A queued run that never starts is often a stuck wake
              flag — <B>Clear wake flag</B>. <B>Cancel</B> a queued/running request in the queue (it stops at
              the next safe point — there&rsquo;s no force-kill). <B>Fetch logs</B> for the error. &ldquo;All
              due&rdquo; with nothing enabled silently does nothing.
            </Fix>
            <Fix symptom="A run finished but nothing published.">
              It generated locally but export → R2 → Neon failed (often transient). Click <B>Re-run publish</B> — it re-publishes without regenerating.
            </Fix>
            <Fix symptom="Nothing is in Pending approval after a run.">
              Either the run failed (check Recent engine runs), or the asset&rsquo;s policy is <B>Auto-publish</B>
              (it went straight live — check the editions browser), or no asset was due/enabled.
            </Fix>
            <Fix symptom="The track record isn't growing.">
              Predictions only score after the window closes (BTC ~24h). To grow it now, <B>Backdate</B> a run
              then <B>Score now</B>. If Score now does nothing, no windows have closed yet.
            </Fix>
            <Fix symptom="A command errors about a migration.">
              The engine tables may be unmigrated. This is a one-time engine/DB setup task — the web app
              can&rsquo;t run the migration itself; surface it to engineering.
            </Fix>
            <Fix symptom="I want a clean slate before launch.">
              Use <B>Full reset (all four)</B> — it clears Neon catalog + box reports + ledger + R2 in a safe
              order so nothing is orphaned. Then redo the first-run checklist.
            </Fix>
          </div>

          <H>Members &amp; billing (reference)</H>
          <UL>
            <li><B>Preview tier (Free/Pro)</B> — you get Pro free as admin; switch to Free to see the non-subscriber view. Your admin access is unaffected.</li>
            <li>
              <B>Grant Pro / Revoke Pro</B> — a <B>complimentary (comp)</B> toggle only: it flips a
              member&rsquo;s <code className="text-[11px]">subscribed</code> flag. A real <B>paid</B>
              subscription must be cancelled/refunded in the <B>Clerk dashboard</B> — revoking here would just
              be re-set on their next billing event.
            </li>
            <li><B>Revalidate content</B> (in Manage access) — force-refresh cached published content if the public site looks stale.</li>
          </UL>

          <H>Glossary</H>
          <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
            <Term t="Edition">one generated report for one instrument on one date. Hidden until approved.</Term>
            <Term t="Due">an asset whose schedule (cadence + roll_utc) says it should generate now.</Term>
            <Term t="roll_utc">the UTC hour that defines an asset&rsquo;s day / window start.</Term>
            <Term t="Prediction window">the period a prediction covers (BTC ~24h); scored only after it closes.</Term>
            <Term t="Outcome ledger">the append-only record of scored results; source of the track record + per-instrument confidence.</Term>
            <Term t="Backdate (as-of)">generate a report dated to the past so its window is already closed and scorable now.</Term>
            <Term t="The box / poller">the Oracle Cloud VM running the engine; polls the queue every ~30s. No inbound ports.</Term>
            <Term t="Wake flag">a low-latency nudge that makes the box poll sooner after you queue work.</Term>
            <Term t="Re-run publish">re-runs export → R2 → Neon for a run that generated but didn&rsquo;t publish.</Term>
            <Term t="Automation paused">the automatic 05:00 UTC batch is off; manual runs still work.</Term>
          </dl>
        </div>
      )}
    </div>
  );
}

function Ref({ title, danger, children }: { title: React.ReactNode; danger?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className={`text-sm font-semibold ${danger ? "text-[#cf222e]" : "text-navy"}`}>{title}</div>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">{children}</ul>
    </div>
  );
}

function Fix({ symptom, children }: { symptom: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-tile/30 px-3 py-2">
      <div className="text-sm font-semibold text-navy">{symptom}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function Term({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="inline font-semibold text-navy">{t} — </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}
