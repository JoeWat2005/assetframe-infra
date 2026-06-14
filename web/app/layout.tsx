import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppFrame from "@/components/AppFrame";
import SmoothNav from "@/components/SmoothNav";
import Motion from "@/components/Motion";
import ConsentAnalytics from "@/components/ConsentAnalytics";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE } from "@/site.config";
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
  openGraph: { title: SITE.brand, description: SITE.tagline, type: "website" },
  twitter: { card: "summary_large_image", title: SITE.brand, description: SITE.tagline },
  robots: { index: true, follow: true },
};

const clerkAppearance = {
  variables: {
    colorPrimary: "#0b2545",
    colorText: "#24292f",
    colorTextSecondary: "#57606a",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#24292f",
    borderRadius: "0.625rem",
    fontFamily: "var(--font-sans)",
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
    card: "rounded-2xl border border-line bg-white shadow-[0_12px_40px_-12px_rgba(11,37,69,0.18)] ring-0",
    headerTitle: "font-heading text-xl font-bold text-navy",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButton: "rounded-lg border-line hover:bg-tile",
    socialButtonsBlockButtonText: "font-semibold text-ink",
    dividerLine: "bg-line",
    dividerText: "text-muted-foreground",
    formFieldLabel: "font-semibold text-ink",
    formFieldInput: "rounded-lg border-line bg-white focus:border-navy",
    // Flat solid navy button (kill Clerk's default gradient + inset shine).
    formButtonPrimary: "rounded-lg bg-navy bg-none shadow-none hover:bg-navy-700 text-white font-semibold normal-case",
    footerActionLink: "font-semibold text-navy hover:text-navy-700",
    badge: "bg-tile text-navy",
    formResendCodeLink: "text-navy",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" className={cn("h-full antialiased", "font-sans", geist.variable)}>
        <body className="flex min-h-full flex-col bg-bg">
          <script
            dangerouslySetInnerHTML={{
              __html:
                "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('gsap-on')}}catch(e){}",
            }}
          />
          <AppFrame header={<Header />} footer={<Footer />}>{children}</AppFrame>
          <SmoothNav />
          <Motion />
          <Analytics />
          <SpeedInsights />
          <ConsentAnalytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
