import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";

import { GitHubSignInButton } from "./GitHubSignInButton";

const startGithubOAuthMock = vi.fn();

vi.mock("../../auth/github-oauth", () => ({
  startGithubOAuth: (redirectTo?: string) => startGithubOAuthMock(redirectTo),
}));

describe("GitHubSignInButton", () => {
  beforeEach(() => {
    startGithubOAuthMock.mockClear();
  });

  it("shows default label and enabled state before click", () => {
    render(<GitHubSignInButton />);

    const button = screen.getByRole("button", { name: /entrar com github/i });
    expect(button).toBeEnabled();
  });

  it("on click, disables the button, changes label, and starts oauth with redirectTo", async () => {
    const user = userEvent.setup();
    render(<GitHubSignInButton redirectTo="/dashboard" />);

    const button = screen.getByRole("button", { name: /entrar com github/i });
    await user.click(button);

    expect(startGithubOAuthMock).toHaveBeenCalledWith("/dashboard");
    expect(screen.getByRole("button", { name: /redirecionando/i })).toBeDisabled();
  });

  it("calls startGithubOAuth with undefined when no redirectTo is provided", async () => {
    const user = userEvent.setup();
    render(<GitHubSignInButton />);

    await user.click(screen.getByRole("button", { name: /entrar com github/i }));

    expect(startGithubOAuthMock).toHaveBeenCalledWith(undefined);
  });
});
