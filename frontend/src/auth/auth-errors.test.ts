import { describe, expect, it } from "vitest";

import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it("returns null when code is null", () => {
    expect(authErrorMessage(null)).toBeNull();
  });

  it.each(["access_denied", "sem_token", "token_invalido"])(
    "returns a specific message for known code %s",
    (code) => {
      const message = authErrorMessage(code);
      expect(message).toBeTruthy();
      expect(typeof message).toBe("string");
    },
  );

  it("returns the fallback message for an unknown code", () => {
    expect(authErrorMessage("codigo_desconhecido")).toBe(
      "Não foi possível concluir o login com o GitHub. Tente novamente.",
    );
  });
});
