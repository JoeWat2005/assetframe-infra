# WCAG 2.2 AA commitment

AssetFrame's stated accessibility bar is **WCAG 2.2 Level AA**. This is asserted on the public `/accessibility` page and set as the target in `LAUNCH_AUDIT.md`'s accessibility audit section. This doc maps the specific success criteria the codebase visibly addresses, and flags what is claimed-but-not-verified.

## Criteria addressed in code

| WCAG SC | Level | How AssetFrame addresses it | Evidence |
| --- | --- | --- | --- |
| 1.3.1 Info & Relationships | A | Semantic landmarks (banner/main/footer), labelled form controls, ordered headings | `AppFrame.tsx`, form components, `tests/a11y-components.test.tsx` |
| 2.4.1 Bypass Blocks | A | "Skip to content" link -> focusable `<main id="main-content" tabIndex={-1}>` | `AppFrame.tsx` (comment cites WCAG 2.4.1) |
| 2.4.7 Focus Visible | AA | `focus-visible:ring-*` on buttons, badges, nav, sheet, inputs, Clerk forms | `components/ui/*`, `app/layout.tsx` (Clerk appearance) |
| 4.1.2 Name, Role, Value | A | Radix primitives supply roles/state; icon buttons have accessible names (e.g. mobile menu `/open menu/i`, sheet "Close") | `tests/a11y-components.test.tsx`, `components/ui/sheet.tsx` |
| 3.3.2 Labels or Instructions | A | Every form field labelled (`<label htmlFor>` / `aria-label`) | feedback form test |
| 2.1.1 Keyboard | A | Radix nav/sheet/select are keyboard-operable; skip link reveals on first Tab | `keyboard-navigation.md` |
| 2.3.3 Animation from Interactions | AAA (exceeds AA) | All motion gated on `prefers-reduced-motion` | `reduced-motion.md` |
| 1.4.3 Contrast (Minimum) | AA | Claimed AA contrast; badges contrast-checked by axe | `/accessibility`, a11y tests |
| 1.4.10 Reflow | AA | Claimed reflow at 200% zoom | `/accessibility` |
| 1.4.13 Content on Hover/Focus | AA | Radix popovers/menus dismiss and persist per spec | Radix primitives |

## WCAG 2.2-specific criteria

WCAG 2.2 (the targeted version) adds nine criteria over 2.1. The ones most relevant here:

- **2.4.11 Focus Not Obscured (Minimum), AA** — the fixed header reserves its height (`pt-14`) and `main` uses `scroll-mt-14`, which helps keep focused content clear of the sticky header. NOT VERIFIED across every interactive element.
- **2.5.7 Dragging Movements, AA** and **2.5.8 Target Size (Minimum), AA** — no drag-only interactions exist; target sizes use the `ui` button/badge sizing. NOT VERIFIED against the 24x24 CSS-px minimum on every control.
- **3.3.7 Redundant Entry / 3.3.8 Accessible Authentication** — authentication is delegated to **Clerk**, whose hosted/components handle accessible auth; this inherits Clerk's conformance rather than the app's. NOT VERIFIED independently.

## Not verified / outstanding

These are **claimed** (on `/accessibility`) or **targeted** (in `LAUNCH_AUDIT.md`) but not automatically verified in this repo:

- **Contrast ratios (1.4.3) and 200% reflow (1.4.10)** — jsdom cannot verify these; needs a real-browser audit (Lighthouse / axe DevTools / `@axe-core/playwright`).
- **Full-page conformance** — only Header, FeedbackForm, and `ui` primitives are axe-tested; the reader/account/admin/pricing pages are not.
- **Target size (2.5.8)** and **focus-not-obscured (2.4.11)** across all components.
- No formal VPAT / conformance statement beyond `/accessibility`.

## Maintaining the claim

- Keep `/accessibility`'s wording aligned with reality — if a feature regresses, update the page (site-consistency rule).
- Run the vitest-axe suite in CI (`../testing/accessibility-tests.md`) so role/name/label regressions fail fast.
- Before asserting AA publicly for a new page, run a real-browser axe pass for contrast and reflow.

## Related docs

- `overview.md`, `keyboard-navigation.md`, `reduced-motion.md`.
- `../testing/accessibility-tests.md`, `../testing/e2e-tests.md` (proposed real-browser a11y).
