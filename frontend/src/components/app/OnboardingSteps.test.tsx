import { describe, expect, it } from "vitest";

import { OnboardingSteps } from "./OnboardingSteps";
import { trailSteps } from "../../content/trail-steps";
import { renderWithProviders, screen } from "../../test/render";

describe("OnboardingSteps", () => {
  it("renders the correct amount of steps from trailSteps", () => {
    renderWithProviders(<OnboardingSteps />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(trailSteps.length);

    trailSteps.forEach((step) => {
      expect(screen.getByText(step.title)).toBeInTheDocument();
    });
  });

  it("applies different classes for tone 'trail' vs. other tones", () => {
    renderWithProviders(<OnboardingSteps />);

    const trailStep = trailSteps.find((step) => step.tone === "trail");
    const emberStep = trailSteps.find((step) => step.tone !== "trail");

    expect(trailStep).toBeDefined();
    expect(emberStep).toBeDefined();

    const trailBadge = screen.getByText(trailStep!.number);
    const emberBadge = screen.getByText(emberStep!.number);

    expect(trailBadge.className).toContain("border-trail-500");
    expect(emberBadge.className).toContain("border-ember-400");
    expect(trailBadge.className).not.toContain("border-ember-400");
  });
});
