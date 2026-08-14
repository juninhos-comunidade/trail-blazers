import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";

import { UserMenu } from "./UserMenu";
import { renderWithProviders, screen, signInAs } from "../../test/render";
import { TOKEN_STORAGE_KEY } from "../../auth/auth-context";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

function LandingStub() {
  return <div>página inicial</div>;
}

function renderMenu(route = "/dashboard") {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<UserMenu />} />
      <Route path="/" element={<LandingStub />} />
    </Routes>,
    { route },
  );
}

describe("UserMenu", () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  it("renders nothing when logged out", () => {
    const { container } = renderMenu();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders avatar, username and sign-out button when logged in", () => {
    signInAs({ username: "octocat" });
    renderMenu();

    expect(screen.getByText("octocat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sair/i })).toBeInTheDocument();
    // no avatarUrl in the signed-in payload -> falls back to the initial letter
    expect(screen.getByText("o")).toBeInTheDocument();
  });

  it("calls signOut (clearing the token) before navigating with replace: true", async () => {
    signInAs({ username: "octocat" });
    const user = userEvent.setup();
    renderMenu();

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).not.toBeNull();

    navigateSpy.mockImplementationOnce(() => {
      // At the moment navigate() is invoked, signOut() must already have run.
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: /sair/i }));

    expect(navigateSpy).toHaveBeenCalledWith("/", { replace: true });
  });
});
