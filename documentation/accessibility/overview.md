# Accessibility overview

AssetFrame targets **WCAG 2.2 Level AA** (see `wcag.md`). Accessibility is built into the shared layout and component primitives, automatically regression-tested with vitest-axe, and described to users on the public `/accessibility` page.

## What is in place (verified in code)

- **Skip link + focusable main** — `components/AppFrame.tsx` renders a "Skip to content" link (kept in the DOM, slid off-screen until focused) targeting `<main id="main-content" tabIndex={-1}>`. WCAG 2.4.1. See `keyboard-navigation.md`.
- **Semantic landmarks** — banner (Header), `main`, footer; auth pages render a bare `main`.
- **Accessible interactive components** — navigation, mobile sheet, dialogs, selects, etc. are built on **Radix UI** primitives (`components/ui/*`), which supply roles, focus management, and keyboard interaction. Visible focus is provided via `focus-visible:ring-*` utilities throughout.
- **Labelled forms** — form controls have associated labels / `aria-label`; the feedback form is axe-tested for this (`tests/a11y-components.test.tsx`).
- **Reduced motion** — all motion respects `prefers-reduced-motion`; GSAP reveals are gated by a class that is removed when the user prefers reduced motion (`reduced-motion.md`).
- **Screen-reader text** — `sr-only` spans annotate icon-only affordances (e.g. "(opens in a new tab)", sheet "Close").
- **Heading order** — pages use a single `h1` (Hero) followed by ordered `h2`s; tested.
- **Honeypot, not CAPTCHA** — public forms use a visually-hidden, `aria-hidden`, `tabIndex={-1}` honeypot field for spam, which keeps the forms keyboard- and screen-reader-clean.

## What the public page commits to

`/accessibility` (`app/accessibility/page.tsx`) states the site uses "semantic page landmarks, a skip-to-content link, keyboard-operable navigation and controls, visible focus indicators, labelled form fields and buttons, and colour contrast that meets AA. It respects your reduced-motion system setting, works with screen readers, and reflows at 200% zoom. Interactive components (menus, dropdowns, dialogs) are built on accessible primitives." Keep the implementation and this page in sync (a `LAUNCH_AUDIT.md` site-consistency requirement).

## How it is tested

- **Automated:** vitest-axe over Header, FeedbackForm, and the `ui` primitives in jsdom (`../testing/accessibility-tests.md`). This catches role/name/structure/labelling regressions.
- **Manual:** keyboard-only navigation, focus order, the mobile sheet focus trap, the skip link, and **color contrast** must be checked by hand or in a real browser — jsdom cannot reliably verify contrast or focus order. See `../testing/e2e-tests.md` (proposed `@axe-core/playwright`).

## Gaps / NOT VERIFIED

- Automated a11y coverage is a **sample** (Header, FeedbackForm, primitives) — the reports reader, account, admin, and pricing pages are not in the automated a11y suite.
- 200%-zoom reflow and contrast ratios are **claimed** on `/accessibility` but **not** automatically verified here; treat them as needing a manual/real-browser audit before relying on the AA claim.
- No published VPAT/accessibility statement beyond the `/accessibility` page (NOT VERIFIED).

## Related docs

- `wcag.md`, `keyboard-navigation.md`, `reduced-motion.md`.
- `../testing/accessibility-tests.md`, `../testing/e2e-tests.md`.
