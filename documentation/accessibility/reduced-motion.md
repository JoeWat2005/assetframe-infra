# Reduced motion

AssetFrame uses GSAP for entrance/scroll animations but honours the user's `prefers-reduced-motion: reduce` system setting everywhere, so motion-sensitive users get a static, fully-functional site. (This effectively meets WCAG 2.3.3 Animation from Interactions, which is AAA — above the AA target.)

## How it works

Animation is gated on a single class, **`gsap-on`**, on `<html>`. Pre-paint, an inline script in `app/layout.tsx` adds it only if the user does NOT prefer reduced motion:

```js
try{ if(!matchMedia('(prefers-reduced-motion: reduce)').matches){ document.documentElement.classList.add('gsap-on') } }catch(e){}
```

Running before paint avoids a flash: elements that animate in are pre-hidden in CSS **scoped to `html.gsap-on`**, so when `gsap-on` is absent (reduced motion, or JS disabled) nothing is hidden and content shows immediately.

## CSS layer (`app/globals.css`)

- `.gsap-on [data-animate="up"] { opacity: 0; }` — scroll-reveal nodes start hidden only when motion is on.
- `.gsap-on [data-animate="hero"] > *` — hero children fade/stagger in via a CSS keyframe.
- An explicit reduced-motion guard re-shows hero content and kills decorative loops:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .gsap-on [data-animate="hero"] > * { opacity: 1; animation: none; }
  }
  @media (prefers-reduced-motion: reduce) { .af-drift { animation: none; } }
  @media (prefers-reduced-motion: reduce) { .af-tape  { animation: none; } }
  ```
  So even if `gsap-on` were present, reduced-motion users see static hero content and no drifting/ticker-tape animation.

## JS layer (`components/Motion.tsx`)

The GSAP runtime is a client component that:

- Checks `window.matchMedia("(prefers-reduced-motion: reduce)")` on mount; if it matches, it **removes `gsap-on` and returns immediately** — no GSAP is loaded, no animation runs.
- **Re-checks on change** (the comment notes reduced-motion is re-evaluated), so toggling the OS setting takes effect without a reload.
- Has a **watchdog**: if GSAP is slow or fails to load within ~1800ms, it removes `gsap-on` so content can never be stranded invisible.
- Uses a `MutationObserver` to reveal `data-animate` nodes that mount later (filtered lists, expanded panels) so dynamically-added content is never left at `opacity:0`.

The CSS handles the hero so it can't be stranded even if the JS reverts on navigation; the JS handles the scroll-reveal (`data-animate="up"`) batches.

## Other motion respecting the setting

- The skip link's slide transition is disabled with `motion-reduce:transition-none` (`AppFrame.tsx`).
- `RedirectCountdown.tsx` checks `prefers-reduced-motion` before animating its countdown.

## Net behaviour for a reduced-motion user

- No entrance fades, no scroll reveals, no decorative drift/ticker animation.
- All content is visible immediately and every control works identically.
- No layout shift or flash, because the gating is decided before paint.

## Testing

- Toggle the OS "reduce motion" setting (or Chrome DevTools -> Rendering -> "Emulate CSS prefers-reduced-motion: reduce") and reload — confirm no animations play and nothing is hidden.
- This is **not** covered by the automated suite (jsdom doesn't run GSAP or CSS animations); verify manually or in the proposed real-browser E2E pass (`../testing/e2e-tests.md`).

## Related docs

- `overview.md`, `wcag.md`, `keyboard-navigation.md`.
