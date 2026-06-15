// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as axeMatchers from "vitest-axe/matchers";

// next/link pulls in the App-Router runtime; stub it to a plain anchor for unit rendering.
vi.mock("next/link", () => ({
  default: ({ children, ...p }: { children: React.ReactNode; href: string }) => <a {...p}>{children}</a>,
}));

expect.extend(axeMatchers);

import { Hero, Note, Badge } from "../components/ui";

// Automated a11y guardrail: render representative presentational components and assert axe
// finds no violations (roles, names, structure). Catches regressions in CI/`npm test`.
describe("accessibility (axe)", () => {
  it("hero + badges + note have no axe violations", async () => {
    const { container } = render(
      <main>
        <Hero title="Reports" tag="A directional read and the levels that matter." />
        <div>
          <Badge label="Wait" />
          <Badge label="High" kind="risk" />
          <Badge label="Very High" kind="risk" />
          <Note>Predictions are registered before each window and graded after.</Note>
        </div>
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
