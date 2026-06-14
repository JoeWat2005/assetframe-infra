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
