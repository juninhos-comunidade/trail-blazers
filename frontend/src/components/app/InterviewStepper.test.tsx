import { describe, expect, it, vi } from "vitest";

import { InterviewStepper } from "./InterviewStepper";
import { renderWithProviders, screen } from "../../test/render";

describe("InterviewStepper", () => {
  it("never marks the current step as done, even if maxCompletedStep >= current", () => {
    renderWithProviders(
      <InterviewStepper current={1} maxCompletedStep={4} getStepHref={() => "/x"} />,
    );

    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.queryByText("02")).not.toBeInTheDocument();
    expect(screen.queryByText("03")).not.toBeInTheDocument();
    expect(screen.queryByText("04")).not.toBeInTheDocument();
  });

  it("marks number <= maxCompletedStep && number !== current as done with check icon", () => {
    renderWithProviders(
      <InterviewStepper current={3} maxCompletedStep={2} getStepHref={() => "/x"} />,
    );

    expect(screen.queryByText("01")).not.toBeInTheDocument();
    expect(screen.queryByText("02")).not.toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
    expect(screen.getByText("04")).toBeInTheDocument();
  });

  it("never assigns an href to the active step even if getStepHref would resolve one", () => {
    const getStepHref = vi.fn(() => "/somewhere");
    renderWithProviders(
      <InterviewStepper current={2} maxCompletedStep={3} getStepHref={getStepHref} />,
    );

    const links = screen.getAllByRole("link");
    expect(
      links.find((link) => link.getAttribute("aria-label")?.includes("Repositórios")),
    ).toBeUndefined();
  });

  it("renders a non-active, non-clickable step (no href) without a Link", () => {
    renderWithProviders(
      <InterviewStepper current={1} maxCompletedStep={0} getStepHref={() => undefined} />,
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("hides the step label on mobile unless active", () => {
    renderWithProviders(<InterviewStepper current={2} maxCompletedStep={1} />);

    const activeLabel = screen.getByText("Repositórios");
    expect(activeLabel.className).not.toContain("hidden");

    const inactiveLabel = screen.getByText("Vaga");
    expect(inactiveLabel.className).toContain("hidden");
  });

  it("sets aria-current='step' only on the active <li>", () => {
    renderWithProviders(<InterviewStepper current={3} maxCompletedStep={2} />);

    const items = screen.getAllByRole("listitem");
    const activeItems = items.filter(
      (item) => item.getAttribute("aria-current") === "step",
    );
    expect(activeItems).toHaveLength(1);
    expect(activeItems[0]).toHaveTextContent("Entrevista");
  });

  it.each([
    [1, "0%"],
    [2, "34%"],
    [3, "67%"],
    [4, "100%"],
  ])("progress bar width for current=%i is %s", (current, expectedWidth) => {
    const { container } = renderWithProviders(
      <InterviewStepper current={current} maxCompletedStep={0} />,
    );

    const bar = container.querySelector(".bg-trail-500.absolute.top-0");
    expect(bar).toHaveStyle({ width: expectedWidth });
  });
});
