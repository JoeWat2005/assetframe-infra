import type { Metadata } from "next";
import { Hero } from "@/components/ui";
import { SITE } from "@/site.config";

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "AssetFrame's accessibility statement — our commitment to WCAG 2.2 Level AA, what's conformant, known limitations, and how to report an issue.",
  alternates: { canonical: "/accessibility" },
};

const UPDATED = "16 June 2026";

function Clause({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold text-navy">{n}. {title}</h2>
      <div className="mt-1 space-y-2 text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export default function AccessibilityPage() {
  return (
    <>
      <Hero title="Accessibility" tag="We want everyone to be able to use AssetFrame." />
      <div className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm text-muted-foreground">Last reviewed: {UPDATED}.</p>

        <Clause n="1" title="Our commitment">
          <p>{SITE.brand} aims to meet the <b>Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA</b>, the recognised international standard for digital accessibility. We treat accessibility as part of how the site is built, not an afterthought.</p>
        </Clause>

        <Clause n="2" title="What we've done">
          <p>The site uses semantic page landmarks, a skip-to-content link, keyboard-operable navigation and controls, visible focus indicators, labelled form fields and buttons, and colour contrast that meets AA. It respects your <i>reduced-motion</i> system setting, works with screen readers, and reflows at 200% zoom. Interactive components (menus, dropdowns, dialogs) are built on accessible primitives.</p>
        </Clause>

        <Clause n="3" title="Known limitations">
          <p>We're honest about the edges we're still improving:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Our sign-in and sign-up screens are provided by a third party (Clerk). We style them for visible focus, but we do not control their full markup.</li>
            <li>Downloadable report <b>PDFs</b> are not yet fully tagged for assistive technology. The same report is always available as an accessible <b>HTML</b> version (the “Read in browser” option), which is the recommended route for screen-reader users.</li>
          </ul>
        </Clause>

        <Clause n="4" title="Tell us about a problem">
          <p>If you encounter an accessibility barrier, or you need a report in a different format, please email <a className="text-navy underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> with the page address and a short description of the problem. We aim to respond within five working days and will work with you to provide the information you need in an accessible way.</p>
        </Clause>

        <Clause n="5" title="How we test">
          <p>We use a combination of automated tooling (accessibility linting and axe checks in our build) and manual keyboard-only and screen-reader testing across the main journeys. This statement is reviewed as the site changes.</p>
        </Clause>
      </div>
    </>
  );
}
