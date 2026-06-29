import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, Download } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getCatalog, getEdition } from "@/lib/content";
import { getEntitlement } from "@/lib/entitlements";
import { isFollowing } from "@/lib/social";
import FollowButton from "@/components/FollowButton";
import { Badge, Btn, Note } from "@/components/ui";
import { jsonLdHtml } from "@/lib/jsonld";
import BuyButton from "@/components/BuyButton";
import ViewBeacon from "@/components/ViewBeacon";
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
  if (!e) return { title: "Report" };
  const base = SITE.url.replace(/\/$/, "");
  const canonical = `/reports/${e.date}/${e.slug}`;
  const title = `${e.instrument} — ${e.reportDate}`;
  const description =
    `${e.instrument} (${e.ticker}) — next-session market research for ${e.reportDate}: status, risk, ` +
    `the expected range and the thesis, with every call scored against the tape afterwards.`;
  // `e.preview` is a relative app route ("/api/report/<date>/<slug>/preview.png"), so make it
  // absolute for OpenGraph/Twitter (they require absolute image URLs).
  const image = e.preview ? (e.preview.startsWith("http") ? e.preview : `${base}${e.preview}`) : undefined;
  return {
    title,
    description,
    // Root layout sets alternates.canonical:"/" (shallow-inherited), which would canonicalise every
    // report to the homepage — set the report's own canonical here.
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: `${base}${canonical}`,
      siteName: SITE.brand,
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
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
  const { userId } = await auth();
  const following = await isFollowing(userId, e.slug);
  const back = encodeURIComponent(`/reports/${e.date}/${e.slug}`);
  const base = SITE.url.replace(/\/$/, "");
  const url = `${base}/reports/${e.date}/${e.slug}`;
  // Article structured data so the edition can earn a rich result in search.
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${e.instrument} — next-session market research (${e.reportDate})`,
    datePublished: e.reportDate,
    dateModified: e.reportDate,
    url,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: SITE.brand, url: SITE.url },
    publisher: { "@id": `${SITE.url}/#organization` },
    about: e.instrument,
    // `e.preview` is always a relative route path, so make it absolute (same `base` as the
    // canonical/OG URLs) — Article `image` must be an absolute URL to be eligible for rich results.
    ...(e.preview ? { image: e.preview.startsWith("http") ? e.preview : `${base}${e.preview}` } : {}),
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <ViewBeacon id={`${e.date}/${e.slug}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(articleLd) }} />
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
      {e.dataProvider && (
        <p className="mt-1 text-xs text-muted-foreground">
          Data: {e.dataProvider}
          {e.dataLicense === "commercial" && (e.dataLicenseDegraded ? " — ⚠ non-commercial fallback" : " — licensed")}
        </p>
      )}

      <div className="mt-4">
        <FollowButton
          symbol={e.slug}
          instrument={e.instrument}
          initialFollowing={following}
          signedIn={ent.signedIn}
          signInHref={`/sign-in?redirect_url=${back}`}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">Follow to get an email when a new {e.instrument} edition publishes.</p>
      </div>

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
                <BuyButton admin={ent.admin}>Subscribe to unlock</BuyButton>
                <Btn href="/pricing" sm>What&apos;s in Pro?</Btn>
              </div>
            )}
          </div>
        </>
      )}

      <Note>{SITE.disclaimer}</Note>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        © {SITE.brand}. This report is protected by copyright and licensed for your personal,
        non-commercial use — redistributing, reselling or publicly sharing it is prohibited.{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-navy">Terms</Link>.
      </p>
    </div>
  );
}
