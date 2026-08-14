import { describe, expect, it } from "vitest";

import {
  buildStepHref,
  interviewPath,
  paths,
  reportPath,
  repoReviewPath,
  vacancyReviewPath,
} from "./paths";

describe("reportPath / interviewPath", () => {
  it("returns the base path when sessionId is omitted", () => {
    expect(reportPath()).toBe(paths.report);
    expect(interviewPath()).toBe(paths.interview);
  });

  it("appends the sessionId when provided", () => {
    expect(reportPath("s1")).toBe(`${paths.report}/s1`);
    expect(interviewPath("s1")).toBe(`${paths.interview}/s1`);
  });
});

describe("vacancyReviewPath / repoReviewPath", () => {
  it("always appends the sessionId", () => {
    expect(vacancyReviewPath("s1")).toBe(`${paths.newInterview}/s1`);
    expect(repoReviewPath("s1")).toBe(`${paths.repoChooser}/s1`);
  });
});

describe("buildStepHref", () => {
  it("returns undefined for any step when sessionId is missing", () => {
    expect(buildStepHref(1, {})).toBeUndefined();
    expect(buildStepHref(4, { canViewReport: true })).toBeUndefined();
  });

  it("step 1 -> vacancy review path", () => {
    expect(buildStepHref(1, { sessionId: "s1" })).toBe(vacancyReviewPath("s1"));
  });

  it("step 2 -> repo review path", () => {
    expect(buildStepHref(2, { sessionId: "s1" })).toBe(repoReviewPath("s1"));
  });

  it("step 3 -> interview path", () => {
    expect(buildStepHref(3, { sessionId: "s1" })).toBe(interviewPath("s1"));
  });

  it("step 4 with canViewReport true -> report path", () => {
    expect(buildStepHref(4, { sessionId: "s1", canViewReport: true })).toBe(
      reportPath("s1"),
    );
  });

  it("step 4 with canViewReport false -> undefined", () => {
    expect(buildStepHref(4, { sessionId: "s1", canViewReport: false })).toBeUndefined();
  });

  it("out-of-range steps return undefined", () => {
    expect(buildStepHref(0, { sessionId: "s1" })).toBeUndefined();
    expect(buildStepHref(5, { sessionId: "s1" })).toBeUndefined();
    expect(buildStepHref(-1, { sessionId: "s1" })).toBeUndefined();
  });
});
