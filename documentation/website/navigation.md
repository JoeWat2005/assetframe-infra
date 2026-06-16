# Navigation

Source: `components/Header.tsx` (client component) and `components/Footer.tsx`.

## The four categories

The header nav is organised into **four categories, listed alphabetically**: **Company, Developers, Product, Research**. The ordering is enforced in code by the `NAV` array:

```ts
const NAV = [
  { title: "Company", items: COMPANY },
  { title: "Developers", items: DEVELOPERS },
  { title: "Product", items: PRODUCT },
  { title: "Research", items: RESEARCH },
];
```

Within each category the items are also **alphabetical by label** (explicitly noted in the source comment "Items within each category are alphabetical by label").

### Category contents (label → href, with description + lucide icon)

**Company** (`COMPANY`)
- About → `/about`
- Accessibility → `/accessibility`
- Contact → `/contact`
- Feedback → `/feedback`
- Privacy → `/privacy`
- Terms → `/terms`

**Developers** (`DEVELOPERS`)
- MCP server → `/developers/mcp`
- Overview → `/developers`
- REST API → `/developers/api`

**Product** (`PRODUCT`)
- FAQ → `/faq`
- How it works → `/how-it-works`
- Pricing → `/pricing`

**Research** (`RESEARCH`)
- Reports → `/reports`
- Reviews → `/reviews`
- Track record → `/track-record`

Each item carries a one-line `desc` and a `lucide-react` icon (e.g. `FileText`, `LineChart`, `Terminal`, `Code2`, `Star`, `MessageSquare`). The same `NAV` array drives both the desktop dropdowns and the grouped mobile sheet, so the two stay in sync automatically.

## Desktop (lg and up)

- Uses Radix `NavigationMenu` (`components/ui/navigation-menu.tsx`) with `viewport={false}`.
- Each category is a `NavigationMenuTrigger` opening a `NavigationMenuContent` panel rendered by the local `MenuGrid` component — a 440px-wide grid where each entry shows icon + bold label + muted description.
- The panel is right-aligned (`left-auto right-0`) because the triggers sit in a right-aligned cluster; a left-anchored 440px panel would overflow the viewport.
- The auth controls (`HeaderAuth`) sit to the right of the categories, separated by a left border.

## Mobile / tablet (below lg)

- A hamburger `Button` opens a Radix `Sheet` (`side="right"`, `w-72`).
- The sheet renders the same `NAV` array but **grouped by category with uppercase section headings** ("mirrors the desktop dropdowns so the list reads as sections rather than one long scroll").
- Each link uses `SheetClose` so tapping closes the sheet. The active link is highlighted via `isActive(href)` = `pathname === href || pathname.startsWith(href + "/")`.
- `HeaderAuth mobile` renders at the bottom with an `onNavigate` callback that closes the sheet.

## Header show/hide behaviour

The header is `fixed` and toggles visibility based on scroll (rAF-throttled, passive listener):

- On `/` (home): hidden over the full-screen hero, reveals only after scrolling past `window.innerHeight - 64` (so the white bar never covers the hero).
- On every other page: shown at the top (`y <= 64`), hides when scrolling down past the fold, returns when scrolling up.
- `motion-reduce:transition-none` respects reduced-motion preferences.
- `shown` starts `false` on every render path (including static generation where `usePathname()` is null) so the navbar never paints a stray bar before hydration.

The logo links to `SITE.url` in production, `/` in dev (`HOME` constant).

## Footer

Source: `components/Footer.tsx` (server component). Renders the logo, tagline, a social-links grid (SVG icons from an `ICONS` map, driven by `SITE.socials` — empty values hide the icon), a link grid, the `NewsletterForm` (client), the standing disclaimer and copyright. Social links carry `aria-label`s and the SVG icons are `aria-hidden`.

## Related components

- `HeaderAuth.tsx` — Clerk-aware auth controls (see `../frontend/navigation.md` and `../frontend/components.md`).
- `AppFrame.tsx` — wraps header/footer and strips them on `/sign-in`, `/sign-up`; provides the skip-to-content link.

## Related docs

- `../frontend/navigation.md` — the client-side mechanics in more depth.
- `routes.md` — where each nav link goes and its access level.
