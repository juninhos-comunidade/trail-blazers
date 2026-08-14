import { describe, expect, it } from "vitest";

import { questionKinds } from "./question-kinds";

describe("questionKinds", () => {
  it("has all 4 question types with a label", () => {
    const types: Array<keyof typeof questionKinds> = [
      "logic",
      "scenario",
      "project",
      "code_analysis",
    ];

    for (const type of types) {
      expect(questionKinds[type]).toBeDefined();
      expect(typeof questionKinds[type].label).toBe("string");
      expect(questionKinds[type].label.length).toBeGreaterThan(0);
    }
  });

  it("uses the expected Portuguese labels", () => {
    expect(questionKinds.logic.label).toBe("Lógica");
    expect(questionKinds.scenario.label).toBe("Cenário");
    expect(questionKinds.project.label).toBe("Projeto");
    expect(questionKinds.code_analysis.label).toBe("Análise de código");
  });
});
