# UI patterns

Conventions shared across the frontend. Source: `components/ui.tsx`, `components/ui/*`, `app/layout.tsx`, and the Tailwind theme.

## Design system

- **shadcn/ui + Radix** primitives live in `components/ui/` (`button`, `card`, `input`, `select`, `badge`, `skeleton`, `separator`, `avatar`, `dropdown-menu`, `alert-dialog`, `navigation-menu`, `sheet`, `chart`, `textarea`).
- **App-level layout primitives** live in `components/ui.tsx` (note: not shadcn): `Hero` (full-width navy band, h1 + tagline), `Section`, `Btn` (link-button with `primary`/outline/`pro` variants), `Badge` (status/risk colours), `Note` (info box).
- Brand tokens: navy (`#0b2545` family), `ink`, `tile`, `line`, `muted-foreground`; Pro accent gold (`#9a6700` / `#e6c88a` / `#fffdf5`). Font: Geist.

## Badges

`Badge({ label, kind })` colours by `kind` (`status` / `risk`). Sell / high / very-high variants are deliberately darkened to hold **WCAG AA 4.5:1** contrast.

## Buttons & links

- `Btn` renders an internal `<Link>` or, with `external`, an `<a>` that adds an `aria` "opens in new tab" hint (WCAG G201). `sm` and `variant` modifiers control size/colour.
- Action buttons use `useTransition`; they disable while pending and show a `Loader2` spinner (`CancelSubscription`, `ResumeSubscription`, `BuyButton`).

## Accessibility patterns

- **Skip link** (`AppFrame`): off-screen, focus-visible, jumps to `#main-content` (tabIndex -1) — WCAG 2.4.1.
- **Reduced motion:** `Motion`, `Countdown`, `RedirectCountdown`, and the header transition all honour `prefers-reduced-motion`.
- **ARIA:** `aria-pressed` (`FollowButton`), `aria-expanded`/`aria-controls` (`OpenCallsBrowser`), `aria-live` for result counts and push status, `aria-label` on icon-only buttons (menu, copy, social), `aria-hidden` on decorative icons/backdrops and loading placeholders.
- **Forms:** labelled inputs, honeypot fields `aria-hidden` + `tabIndex={-1}`.
- Backed by tests: `tests/a11y.test.tsx`, `tests/a11y-components.test.tsx`.

## Animation

- GSAP via `Motion`: `data-animate="up"` (scroll-reveal) and `data-animate="hero"` (load-in). A MutationObserver catches late-mounted nodes; a watchdog (1800ms) un-hides everything if GSAP fails.
- Decorative SVG backdrops (`HeroBackdrop`, `AuthBackdrop`) are deterministic so SSR and client match.

## Lists, filtering & pagination

A repeated pattern across `ReportsBrowser`, `OpenCallsBrowser`, `ScoredResults`: a search input + several `Select` dropdowns + a "Show more"/page control, all computed client-side with `useMemo`, with a live result count and a "Clear" affordance. Page sizes: reports 12, open calls 15, scored results 25.

## Code blocks

`app/developers/CodeBlock.tsx`: dark navy `<pre>` with a copy-to-clipboard button (Check/Copy icons, 1.5s confirmation). Clipboard failure is a silent no-op.

## Charts

`components/ui/chart.tsx` wraps Recharts (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`). Only `TrackRecordAnalytics` uses charts; it is client-only and Pro-gated.

## Layout / metadata (root)

`app/layout.tsx`: `ClerkProvider` (navy-themed appearance), Vercel `Analytics` + `SpeedInsights`, `ConsentAnalytics`, `Motion`; metadata title template `%s — AssetFrame`, OpenGraph/Twitter, and a four-entity JSON-LD `@graph` (Organization, WebSite with SearchAction, SoftwareApplication with offers, Dataset for the track record).

## Related docs

- `components.md`, `forms.md`, `navigation.md`, `state-and-rendering.md`.
- `../website/company-pages.md` — page-level JSON-LD (FAQ, AggregateRating, Article).
