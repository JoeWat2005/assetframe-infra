import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, Download } from "lucide-react";
import { getCatalog, getEdition } from "@/lib/content";
import { getEntitlement } from "@/lib/entitlements";
import { Badge, Btn, Note } from "@/components/ui";
import BuyButton from "@/components/BuyButton";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic"; // reads auth for the gated sections

export async function generateStaticParams() {
  return (await getCatalog()).map((e) => ({ date: e.date, slug: e.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ date: string; slug: string }> }
): Promise<Metadata> {
  const { date, slug } = await params;
  const e = await getEdition(date, slug);
  return { title: e ? `${e.instrument} — ${e.reportDate}` : "Report" };
}

// Identical "open the report" controls for Free and Pro, so HTML vs PDF reads the same
// everywhere: read the formatted report in a new tab, or download the PDF.
function ReportLinks({ html, pdf }: { html: string; pdf: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Btn href={html} variant="primary" external sm>
        <BookOpen className="mr-1.5 size-4" /> Read in browser
      </Btn>
      <Btn href={pdf} external sm>
        <Download className="mr-1.5 size-4" /> Download PDF
      </Btn>
    </div>
  );
}

export default async function ReaderPage(
  { params }: { params: Promise<{ date: string; slug: string }> }
) {
  const { date, slug } = await params;
  const e = await getEdition(date, slug);
  if (!e) notFound();

  const ent = await getEntitlement();
  const back = encodeURIComponent(`/reports/${e.date}/${e.slug}`);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/reports" className="text-sm text-muted-foreground hover:text-navy">← All reports</Link>
      <h1 className="mt-2 text-3xl font-bold">{e.instrument}</h1>
      <div className="text-sm font-semibold text-muted-foreground">{e.ticker} · {e.assetClass}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {e.status && <Badge label={e.status} kind="status" />}
        {e.risk && <Badge label={e.risk} kind="risk" />}
      </div>
      <p className="mt-3 text-[15px]">{e.bias}</p>
      <p className="mt-1 text-sm text-muted-foreground">Edition {e.reportDate} · prediction window to {e.windowEnd}</p>
      {e.catalystStatus && <p className="mt-1 text-sm text-muted-foreground"><b>Catalyst:</b> {e.catalystStatus}</p>}

      {!ent.signedIn ? (
        // Friendly gate: the teaser above stays visible, but reading the report needs an account.
        <div className="mt-6 rounded-xl border border-line bg-white p-6 text-center">
          <div className="text-lg font-bold text-navy">Create a free account to read this report</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            The one-page Snapshot is free to read once you have an account. Pro unlocks the full
            report — price ladder, risk math and the outcome ledger — on every edition.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Btn href={`/sign-up?redirect_url=${back}`} variant="primary">Create free account</Btn>
            <Btn href={`/sign-in?redirect_url=${back}`}>Sign in</Btn>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-xl border border-line bg-white p-5">
            <div className="text-lg font-bold">Free Snapshot</div>
            <p className="mt-1 text-sm text-muted-foreground">The one-page read: status, risk, broad range, one chart and the thesis.</p>
            <ReportLinks html={e.freeHtml} pdf={e.freePdf} />
          </div>

          <div className="mt-4 rounded-xl border border-[#e6c88a] bg-[#fffdf5] p-5">
            <div className="text-lg font-bold text-[#9a6700]">Pro report</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Conditional long &amp; short setups, the price ladder, sentiment, risk math, the trade-quality
              scorecard, the outcome ledger and the full source audit.
            </p>
            {ent.subscribed ? (
              <ReportLinks html={`/api/report/${e.date}/${e.slug}/pro.html`} pdf={`/api/report/${e.date}/${e.slug}/pro.pdf`} />
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <BuyButton>Subscribe to unlock</BuyButton>
                <Btn href="/pricing" sm>What&apos;s in Pro?</Btn>
              </div>
            )}
          </div>
        </>
      )}

      <Note>{SITE.disclaimer}</Note>
    </div>
  );
}
