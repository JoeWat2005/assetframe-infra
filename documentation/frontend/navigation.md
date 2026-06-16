# Frontend navigation (client mechanics)

The information architecture (four categories, alphabetical, contents) is documented in `../website/navigation.md`. This page covers the client-side implementation.

## `Header.tsx` (client component)

- Uses `usePathname()` to compute `isHome` and `isActive(href)` (`pathname === href || pathname.startsWith(href + "/")`).
- A single `NAV` array (`[Company, Developers, Product, Research]`, each with alphabetical `items`) drives **both** the desktop dropdowns and the mobile sheet.
- **Desktop (lg+):** Radix `NavigationMenu` (`viewport={false}`) with one `NavigationMenuTrigger` per category. The dropdown panel (`MenuGrid`) is right-aligned (`left-auto right-0`) to avoid viewport overflow from the right-aligned trigger cluster. `HeaderAuth` sits to the right behind a border.
- **Mobile/tablet (below lg):** a `Sheet` (right side, `w-72`) renders the same array grouped under uppercase category headings, each link wrapped in `SheetClose`. `HeaderAuth` with the `mobile` prop and an `onNavigate` that closes the sheet renders at the bottom.

### Scroll-driven show/hide
A `useEffect` adds a passive, rAF-throttled `scroll` listener:
- `/` (home): `shown` becomes true only after `scrollY > innerHeight - 64` (clears the full-screen hero).
- Other pages: shown near the top (`y <= 64`), hides on scroll-down past the fold, shows on scroll-up.
- `shown` initialises `false` (even during static generation where `usePathname()` is null) to avoid a flash before hydration.
- `motion-reduce:transition-none` honours reduced-motion.

## `HeaderAuth.tsx` (client component)

- Props `{ mobile?: boolean; onNavigate?: () => void }`.
- Uses Clerk `useUser()` + `useClerk()`; guards on `isLoaded` (renders an `aria-hidden` placeholder while loading).
- Signed-in desktop: "Account" link + Clerk `UserButton`. Signed-in mobile: plain "Account" and "Sign out" links (calls `signOut()`), both closing the sheet — deliberately avoids the `UserButton` popover focus-trap inside the sheet.
- Signed-out: "Sign in" button.

## `AppFrame.tsx` (client component)

- Wraps the whole app body (rendered from `app/layout.tsx`).
- `usePathname()` detects `/sign-in` & `/sign-up` and renders a minimal main region (no header/footer) on those routes.
- Provides the **skip-to-content link** (WCAG 2.4.1): off-screen, becomes visible on focus, targets `#main-content` (which has `tabIndex={-1}` + `scroll-mt-14`).
- Header/footer are passed in as pre-rendered nodes, so the server output is static and the only client branch is the auth-page check.

## Footer links

`Footer.tsx` (server) renders an independent link grid + social icons from `SITE.socials` (empty handles are hidden) and embeds the client `NewsletterForm`. It is not driven by the `NAV` array.

## Related docs

- `../website/navigation.md` — categories and contents.
- `components.md` — `Header`, `HeaderAuth`, `AppFrame`, `Footer` in the component inventory.
- `state-and-rendering.md` — why these are client components.
