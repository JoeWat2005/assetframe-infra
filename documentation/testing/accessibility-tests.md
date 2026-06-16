# Accessibility tests

Automated a11y coverage is provided by **vitest-axe** (axe-core inside Vitest) running against real components in **jsdom**. This is a regression guardrail, not a substitute for manual review or a real-browser audit — see the gaps section.

Files: `web/tests/a11y.test.tsx`, `web/tests/a11y-components.test.tsx`. Both start with `// @vitest-environment jsdom` (line 1).

Run: `cd web && npx vitest run tests/a11y.test.tsx tests/a11y-components.test.tsx`.

## How vitest-axe is wired

- Import `axe` from `vitest-axe` and the matchers from `vitest-axe/matchers`.
- `expect.extend(axeMatchers)` registers the `toHaveNoViolations()` matcher.
- Each test renders a tree with Testing Library, calls `await axe(container)`, and asserts `expect(results).toHaveNoViolations()`.
- `a11y-components.test.tsx` declares a local TypeScript augmentation for `toHaveNoViolations()` on Vitest 4's `Assertion` interface, because vitest-axe@0.1's bundled types target the legacy `Vi.Assertion` namespace. (A real, in-repo type-compat shim — worth knowing if you bump the dep.)
- Because `globals: false`, Testing Library's automatic cleanup is not registered; `a11y-components.test.tsx` calls cleanup explicitly in `afterEach` and installs a `matchMedia` polyfill for Radix/Header effects.

## `tests/a11y.test.tsx` — presentational primitives

Renders a `<main>` containing `Hero`, three `Badge`s ("Wait", "High", "Very High"), and a `Note`, all from `components/ui`. `next/link` is stubbed to a plain anchor.

- **"hero + badges + note have no axe violations"** — axe finds no violations (roles, accessible names, semantic structure; also a contrast-safe check on the badges).

## `tests/a11y-components.test.tsx` — interactive components + page composition

Renders the real `Header` (`components/Header.tsx`), the real `FeedbackForm` (`app/feedback/FeedbackForm.tsx`), and a `Hero`/`Section`/`Badge`/`Note` composition. Framework boundaries are mocked (see `integration-tests.md` for the full stub list: `next/link`, `next/image`, `next/navigation`, `@clerk/nextjs`, the feedback server action).

- **"Header (desktop nav + mobile trigger) has no axe violations"** — renders Header, asserts the banner landmark is present, axe clean.
- **"Header exposes accessible category triggers and a labelled mobile menu button"** — the four category dropdown triggers ("Company", "Developers", "Product", "Research") are present, and the mobile hamburger has an accessible name matching `/open menu/i` (WCAG 4.1.2 Name, Role, Value).
- **"FeedbackForm fields are all labelled and the form has no axe violations"** — every control is reachable by accessible name: feedback textarea (`/your feedback/i`), email field (`/email/i`), category combobox (`/feedback category/i`), submit button (`/send feedback/i`); axe clean.
- **"hero + section + badges compose with valid heading order and no violations"** — asserts exactly one `h1` and at least one `h2` (no skipped heading levels); axe clean.

## What these cover

- Roles, accessible names, and semantic structure (general axe-core ruleset, WCAG 2.1 mapping).
- WCAG 4.1.2 (accessible names on interactive controls).
- Heading hierarchy (single `h1`, ordered `h2`).
- Form labelling (`<label htmlFor>` / `aria-label`).
- Landmarks (banner).

## Gaps / NOT VERIFIED

- **jsdom is not a browser.** axe-core's color-contrast rule and any visibility/layout-dependent rule are unreliable in jsdom; treat contrast as **not** automatically verified here. Run a real-browser audit (Lighthouse, axe DevTools, or `@axe-core/playwright`) for contrast and focus-order. See `e2e-tests.md` (proposed).
- **Coverage is a sample, not the whole site.** Only Header, FeedbackForm, and the `ui` primitives are axe-tested. The reports reader, account, admin, pricing, and the report-page composition are not in the automated a11y suite.
- **No keyboard-navigation assertions** (tab order, focus trapping in the Radix mobile sheet, the skip link) are automated — these are exercised in the manual playbook and documented under `../accessibility/keyboard-navigation.md`.

The project's stated bar is **WCAG 2.2 AA** (see `../accessibility/wcag.md` and `LAUNCH_AUDIT.md`'s accessibility section); these tests are one layer toward it.

## Related docs

- `../accessibility/overview.md`, `../accessibility/wcag.md`, `../accessibility/keyboard-navigation.md`, `../accessibility/reduced-motion.md`.
- `integration-tests.md` (the jsdom component-integration setup these share), `strategy.md`.
