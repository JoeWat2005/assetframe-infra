// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as axeMatchers from "vitest-axe/matchers";
import type { AxeResults } from "axe-core";

// vitest-axe@0.1's bundled augmentation targets the legacy `Vi.Assertion`, which Vitest 4
// no longer uses for `expect(...)`, so `.toHaveNoViolations()` isn't typed. Re-declare it on
// Vitest 4's `Assertion`/`AsymmetricMatchersContaining`. Global, so it also covers the sibling
// a11y.test.tsx. Runtime behaviour is unchanged — the matcher is registered via expect.extend.
interface AxeMatchers<R = unknown> {
  toHaveNoViolations(results?: AxeResults): R;
}
declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends AxeMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

// globals:false means Testing Library's automatic afterEach cleanup is NOT registered,
// so unmount between tests explicitly — otherwise repeated renders accumulate in the DOM
// and duplicate-element queries fail.
afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Module stubs. These components pull in App-Router + Clerk + next/image
// runtimes that aren't available under plain jsdom, so we replace them with
// minimal, accessibility-faithful stand-ins (same roles/markup the user sees).
// ---------------------------------------------------------------------------
vi.mock("next/link", () => ({
  default: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => (
    <a href={typeof href === "string" ? href : "#"} {...p}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt = "", src, ...p }: { alt?: string; src: string }) => <img alt={alt} src={typeof src === "string" ? src : ""} {...p} />,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Clerk: HeaderAuth renders the signed-out branch (a "Sign in" link). useClerk is
// referenced at module scope, so it must exist even though we render signed-out.
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: false, isLoaded: true, user: null }),
  useClerk: () => ({ signOut: vi.fn() }),
  UserButton: () => <button type="button" aria-label="Account menu" />,
}));

expect.extend(axeMatchers);

// matchMedia is used by Radix/Header effects; jsdom doesn't implement it.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  }
});

import Header from "../components/Header";
import FeedbackForm from "../app/feedback/FeedbackForm";

// The feedback server action would hit the network; stub it to a resolved result.
vi.mock("../app/feedback/actions", () => ({
  submitFeedback: vi.fn(async () => ({ ok: true, message: "Thanks!" })),
}));

describe("accessibility (axe) — interactive components", () => {
  it("Header (desktop nav + mobile trigger) has no axe violations", async () => {
    const { container } = render(<Header />);
    // Brand link + nav landmark are present.
    expect(screen.getByRole("banner")).toBeTruthy();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Header exposes accessible category triggers and a labelled mobile menu button", () => {
    render(<Header />);
    // The four alphabetical category dropdown triggers (desktop).
    for (const label of ["Company", "Developers", "Product", "Research"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // Mobile hamburger has an accessible name (WCAG 4.1.2).
    expect(screen.getByRole("button", { name: /open menu/i })).toBeTruthy();
  });

  it("FeedbackForm fields are all labelled and the form has no axe violations", async () => {
    const { container } = render(<FeedbackForm />);
    // Each visible control resolves to an accessible name via <label htmlFor> / aria-label.
    expect(screen.getByLabelText(/your feedback/i)).toBeTruthy();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /feedback category/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /send feedback/i })).toBeTruthy();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// A representative content surface assembled from the shared primitives the public
// pages use (Hero h1 + Section h2 + Note + status/risk badges), checked for correct
// heading order and contrast-safe badges.
import { Hero, Section, Note, Badge } from "../components/ui";

describe("accessibility (axe) — representative page composition", () => {
  it("hero + section + badges compose with valid heading order and no violations", async () => {
    const { container } = render(
      <main>
        <Hero title="Track record" tag="Scored after the fact." />
        <Section title="Scored results" lead="Every call, graded against the tape.">
          <div className="flex gap-2">
            <Badge label="Buy" kind="status" />
            <Badge label="Sell" kind="status" />
            <Badge label="Very High" kind="risk" />
          </div>
          <Note>Predictions are registered before each window and graded after.</Note>
        </Section>
      </main>
    );

    // One h1 (Hero), and the Section heading is an h2 — correct order, no skips.
    const h1s = within(container).getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(within(container).getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
