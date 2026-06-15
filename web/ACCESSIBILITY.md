# AssetFrame — accessibility record

Target: **WCAG 2.2 Level AA**. This is the internal record behind the public
`/accessibility` statement. Update the "Last reviewed" date in `app/accessibility/page.tsx`
whenever this is re-checked.

## Conformance fixes applied
- **Skip link** (`components/AppFrame.tsx`) → `<main id="main-content">` (WCAG 2.4.1).
- **Accessible names**: search `Input`s and every filter `Select` now carry `aria-label`
  (placeholders/`SelectValue` are not names) across `ReportsBrowser`, `OpenCallsBrowser`,
  `admin/EditionsBrowser`, `admin/AdminLog`, `ScoredResults` (1.3.1 / 4.1.2).
- **Colour contrast** (1.4.3): hero secondary text on navy raised to `white/70`; status/risk
  badge backgrounds darkened so white text clears 4.5:1 — sell/very-high `#b91c1c`, high-risk
  `#9a3d00` (in both `components/ui.tsx` and `components/ReportCard.tsx`).
- **Target size** (2.5.8) + names: footer social links are a ≥36px hit area with descriptive
  `aria-label`s; the SVGs are `aria-hidden`.
- **Pager/disclosure names**: Prev/Next buttons and the open-call expand toggle carry `aria-label`s.

## Already-good baseline (verified in code)
`<html lang="en">` · landmarks `header`/`main`/`footer` · Radix/shadcn primitives (keyboard +
ARIA) · `prefers-reduced-motion` honoured with failsafes (`Motion.tsx` + `globals.css`) ·
focus-visible rings on Button/Input/Badge · single-`h1` heading hierarchy · image `alt` text ·
viewport zoom not disabled.

## Automated checks
- `npm run lint` — `eslint-plugin-jsx-a11y` (recommended ruleset) must pass.
- `npm test` — `vitest-axe` smoke tests render key components and assert no axe violations.

## Manual test checklist (run before a release that touches UI)
Keyboard-only (no mouse): Tab/Shift-Tab/Enter/Space/Esc/arrows.
- [ ] Tab from page top reveals the **Skip to content** link; it jumps focus to `<main>`.
- [ ] Header nav + mega-menu reachable and operable; mobile sheet opens, traps focus, closes on Esc.
- [ ] `/reports`: every filter dropdown + the search box reachable; Show-more works; focus visible throughout.
- [ ] Open a report → "Read in browser" / "Download" reachable; sign-in flow operable.
- [ ] No keyboard traps; focus order matches visual order.

Screen reader (NVDA on Windows, or VoiceOver):
- [ ] Landmarks list shows banner / main / contentinfo.
- [ ] Headings list is logical (one h1 per page).
- [ ] Every control announces a sensible name + role (filters say "Asset class", "Sort by", etc.).
- [ ] Status/risk badges and the public-ledger numbers are understandable in reading order.

## Findings log
- 2026-06-16 — Conformance pass applied (above). Automated lint+axe added. Manual keyboard +
  screen-reader pass: _pending first run_ — record date + any issues here.
