import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppFrame from "@/components/AppFrame";
import Motion from "@/components/Motion";
import ConsentAnalytics from "@/components/ConsentAnalytics";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE } from "@/site.config";
import { jsonLdHtml } from "@/lib/jsonld";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: { default: `${SITE.brand} — ${SITE.tagline}`, template: `%s — ${SITE.brand}` },
  description:
    "Pre-session market research and decision support: a free Snapshot and a full Pro report " +
    "for each instrument, with every call scored against the tape afterwards. Not personal advice.",
  metadataBase: new URL(SITE.url),
  alternates: { canonical: "/" },
  applicationName: SITE.brand,
  openGraph: {
    title: SITE.brand,
    description: SITE.tagline,
    type: "website",
    siteName: SITE.brand,
    url: SITE.url,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.brand,
    description: SITE.tagline,
    site: "@AssetFrame",
    creator: "@AssetFrame",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

// Sitewide structured data so search + AI engines recognise the entity, the site, the
// product (with its MCP/REST access points) and the public track-record dataset.
const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.brand,
      url: SITE.url,
      logo: `${SITE.url}/logo.png`,
      email: SITE.contactEmail,
      description:
        "AssetFrame publishes next-session market-research reports on stocks, crypto, FX and commodities, with every call graded against the market afterwards. Not regulated financial advice.",
      sameAs: Object.values(SITE.socials).filter(Boolean),
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SITE.contactEmail,
        availableLanguage: "en",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.brand,
      url: SITE.url,
      inLanguage: "en-GB",
      publisher: { "@id": `${SITE.url}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/reports?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      // The product itself: scored market-research reports, reachable by humans (web) and
      // by AI agents (MCP server + read-only REST API). Helps assistants describe and cite
      // what AssetFrame actually is and how to access it.
      "@type": "SoftwareApplication",
      "@id": `${SITE.url}/#software`,
      name: SITE.brand,
      url: SITE.url,
      applicationCategory: "FinanceApplication",
      applicationSubCategory: "Market research and decision support",
      operatingSystem: "Web, MCP, REST API",
      description:
        "AssetFrame publishes a free Snapshot and a paid Pro report for each instrument (stocks, crypto, FX, commodities). " +
        "Every call registers falsifiable price predictions before the session and is graded Hit / Miss / No-trigger against " +
        "the tape afterwards in an append-only ledger. Confidence is a calibrated, after-the-fact score — not a guarantee or a " +
        "trade signal. Reports are accessible to AI agents over an MCP server and a read-only REST API. " +
        "This is general market research and decision support, not regulated financial advice, and it never places trades.",
      publisher: { "@id": `${SITE.url}/#organization` },
      provider: { "@id": `${SITE.url}/#organization` },
      isAccessibleForFree: true,
      featureList: [
        "Free one-page Snapshot per instrument",
        "Pro report: conditional setups, price ladder, scenario matrix, event-risk timeline, trade-quality scorecard",
        "Public append-only outcome ledger with calibrated confidence",
        "MCP server for AI agents (Streamable HTTP)",
        "Read-only REST API with OpenAPI 3.1 schema",
      ],
      offers: [
        { "@type": "Offer", name: "Snapshot", price: "0", priceCurrency: "USD", description: "Free one-page Snapshot on every edition." },
        { "@type": "Offer", name: "Pro", price: "9.99", priceCurrency: "USD", category: "subscription", url: `${SITE.url}/pricing`, description: "Full Pro report, billed monthly. Cancel anytime." },
      ],
      potentialAction: {
        "@type": "ConsumeAction",
        name: "Access AssetFrame research over MCP",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/api/mcp`, contentType: "application/json" },
      },
    },
    {
      // The public track record as a citable dataset: every scored call, append-only,
      // available as a page and as a JSON endpoint.
      "@type": "Dataset",
      "@id": `${SITE.url}/#track-record`,
      name: "AssetFrame public track record",
      url: `${SITE.url}/track-record`,
      description:
        "Append-only record of every AssetFrame call: registered before its prediction window and graded Hit / Miss / No-trigger " +
        "against the price tape afterwards, with overall hit rate, streaks and per-confidence calibration. Rows are never edited.",
      license: `${SITE.url}/terms`,
      isAccessibleForFree: true,
      creator: { "@id": `${SITE.url}/#organization` },
      publisher: { "@id": `${SITE.url}/#organization` },
      distribution: [
        {
          "@type": "DataDownload",
          encodingFormat: "application/json",
          contentUrl: `${SITE.url}/api/v1/track-record`,
        },
      ],
    },
  ],
};

// Reusable BreadcrumbList JSON-LD for nested pages (e.g. /developers/mcp, a report).
// Drop <BreadcrumbJsonLd items={[{name:"Developers",path:"/developers"},…]} /> into any
// page that sits below the top level; "Home" is prepended and positions are 1-based.
export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  const base = SITE.url.replace(/\/$/, "");
  const all = [{ name: SITE.brand, path: "/" }, ...items];
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${base}${it.path === "/" ? "" : it.path}`,
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(ld) }} />;
}

const clerkAppearance = {
  variables: {
    colorPrimary: "#0b2545",
    colorText: "#24292f",
    colorTextSecondary: "#57606a",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#24292f",
    colorDanger: "#cf222e",
    colorSuccess: "#1a7f37",
    colorWarning: "#9a6700",
    colorShimmer: "#7fb0ff",
    borderRadius: "0.625rem",
    fontFamily: "var(--font-sans)",
    fontSize: "0.9375rem",
  },
  layout: {
    logoImageUrl: "/logo.png",
    logoLinkUrl: "/",
    logoPlacement: "inside" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none",
    card: "rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(11,37,69,0.04),0_12px_32px_-16px_rgba(11,37,69,0.20)] ring-0",
    header: "gap-1",
    headerTitle: "font-heading text-xl font-bold text-navy",
    headerSubtitle: "text-muted-foreground text-sm",
    socialButtons: "gap-2",
    socialButtonsBlockButton: "rounded-lg border border-line bg-white text-ink shadow-none transition-colors hover:bg-tile",
    socialButtonsBlockButtonText: "font-semibold text-ink",
    socialButtonsProviderIcon: "size-5",
    dividerRow: "my-4",
    dividerLine: "bg-line",
    dividerText: "text-muted-foreground text-xs uppercase tracking-wide",
    formFieldLabel: "font-semibold text-ink",
    formFieldInput: "rounded-lg border border-line bg-white text-ink placeholder:text-muted-foreground shadow-none focus:border-navy focus:ring-2 focus:ring-navy/30 focus:ring-offset-0 data-[invalid]:border-[#cf222e]",
    formFieldInputShowPasswordButton: "text-muted-foreground hover:text-navy",
    otpCodeFieldInputs: "gap-2",
    otpCodeFieldInput: "rounded-lg border border-line bg-white text-ink focus:border-navy focus:ring-2 focus:ring-navy/30",
    // Flat solid navy button (kill Clerk's default gradient + inset shine).
    formButtonPrimary: "rounded-lg bg-navy bg-none shadow-none text-white font-semibold normal-case transition-colors hover:bg-navy-700 active:bg-navy-700 before:hidden after:hidden focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2",
    formFieldErrorText: "text-[#cf222e] text-sm",
    formFieldSuccessText: "text-[#1a7f37] text-sm",
    formFieldWarningText: "text-[#9a6700] text-sm",
    formFieldAction: "font-medium text-navy hover:text-navy-700",
    footer: "border-t border-line",
    footerAction: "text-muted-foreground",
    footerActionLink: "font-semibold text-navy hover:text-navy-700",
    identityPreview: "rounded-lg border border-line bg-tile",
    identityPreviewText: "text-ink",
    identityPreviewEditButton: "text-navy hover:text-navy-700",
    badge: "bg-tile font-medium text-navy",
    formResendCodeLink: "font-medium text-navy hover:text-navy-700",
    spinner: "text-navy",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider appearance={clerkAppearance} allowedRedirectOrigins={[SITE.url]}>
      <html lang="en" className={cn("h-full antialiased", "font-sans", geist.variable)}>
        <body className="flex min-h-full flex-col bg-bg">
          <script
            dangerouslySetInnerHTML={{
              __html:
                "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('gsap-on')}}catch(e){}",
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdHtml(orgJsonLd) }}
          />
          <AppFrame header={<Header />} footer={<Footer />}>{children}</AppFrame>
          <Motion />
          <Analytics />
          <SpeedInsights />
          <ConsentAnalytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
