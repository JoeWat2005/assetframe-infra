# Keyboard navigation

Everything actionable is reachable and operable by keyboard. The mechanisms below are concrete and grounded in the components.

## Skip link (WCAG 2.4.1)

`components/AppFrame.tsx` renders, as the first focusable element on every non-auth page:

```html
<a href="#main-content" class="fixed left-2 top-2 z-[100] -translate-y-20 ... focus:translate-y-0 motion-reduce:transition-none">
  Skip to content
</a>
```

- It is **kept in the DOM** (not `display:none`) and slid off the top of the viewport (`-translate-y-20`), then **slid into view on focus** (`focus:translate-y-0`) — so it reliably reveals on the first Tab and a sighted keyboard user can see it.
- Its transition is disabled under reduced motion (`motion-reduce:transition-none`).

## Focusable main

The target is `<main id="main-content" tabIndex={-1} className="... outline-none scroll-mt-14">`. `tabIndex={-1}` is essential: it makes `main` programmatically focusable so activating the skip link **actually moves keyboard focus into the content** (not just the scroll position). `scroll-mt-14` keeps the landed content clear of the fixed header. Auth pages (`/sign-in`, `/sign-up`) render a bare `<main id="main-content">` with no nav/footer.

## Header navigation (Radix)

The header (`components/Header.tsx`) uses Radix UI navigation/menu and sheet primitives (`components/ui/navigation-menu.tsx`, `components/ui/sheet.tsx`):

- **Desktop:** four category dropdown triggers ("Company", "Developers", "Product", "Research"). Radix `NavigationMenu` handles arrow-key/Enter/Escape interaction and exposes the triggers with proper roles/state (`data-open`, etc.). The triggers have visible `focus-visible:ring-*` styling.
- **Mobile:** a hamburger button with the accessible name "Open menu" (tested as `/open menu/i`) opens a Radix `Sheet` (a dialog). Radix manages focus trapping inside the open sheet and restores focus on close; the close control carries an `sr-only` "Close" label.

These behaviours come from the Radix primitives rather than custom key handlers, which is why they are robust; the a11y test asserts the triggers and the labelled mobile button exist (`tests/a11y-components.test.tsx`).

## Focus indicators (WCAG 2.4.7)

Focus is visible across the UI via Tailwind `focus-visible:ring-*` utilities on the shared primitives:

- Buttons and badges (`components/ui/button.tsx`, `badge.tsx`) — `focus-visible:ring-[3px]`/`ring-3` rings.
- Inputs, textarea, select (`components/ui/input.tsx`, `textarea.tsx`, `select.tsx`) — `focus-visible:border-ring focus-visible:ring-3`.
- Nav links/triggers (`navigation-menu.tsx`) — `focus-visible:ring-3 ... focus-visible:outline-1`.
- Clerk auth widgets — `formButtonPrimary` carries `focus-visible:ring-2 ... ring-offset-2` (configured in `app/layout.tsx`).

## Forms

- All controls are labelled (`<label htmlFor>` / `aria-label`) so they announce correctly and are reachable in tab order (verified for the feedback form by axe + role queries).
- **Honeypot fields** (e.g. `FeedbackForm.tsx`, `NewsletterForm.tsx`): a `name="company"` text input with `tabIndex={-1}`, `aria-hidden="true"`, and `className="hidden"`. Being `tabIndex={-1}` + hidden keeps it **out of the keyboard tab order and the accessibility tree**, so it traps bots without affecting real keyboard/AT users (an accessible alternative to a CAPTCHA).

## Manual keyboard test checklist

Not automated (jsdom doesn't model real tab order/focus traps), so verify by hand on a real browser:

1. Load any page, press Tab once -> "Skip to content" appears; Enter moves focus into `main`.
2. Tab through the header -> each category trigger is reachable; Enter/Space opens it; arrow keys move within; Escape closes and returns focus to the trigger.
3. At a narrow viewport, Tab to the hamburger ("Open menu") -> Enter opens the sheet; focus is trapped inside; Escape closes and focus returns to the button.
4. Tab through a form -> every field and the submit button are reachable in a sensible order, each with a visible focus ring; the honeypot is never focused.
5. Confirm focus is never lost behind the fixed header.

## Related docs

- `overview.md`, `wcag.md`, `reduced-motion.md`.
- `../testing/accessibility-tests.md` (what the axe suite covers), `../testing/e2e-tests.md` (proposed real-browser keyboard checks).
