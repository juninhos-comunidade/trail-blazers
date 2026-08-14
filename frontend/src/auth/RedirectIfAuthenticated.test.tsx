import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { RedirectIfAuthenticated } from "./RedirectIfAuthenticated";
import { renderWithProviders, screen, signInAs } from "../test/render";

function Login() {
  return <div>página de login</div>;
}

function Dashboard() {
  return <div>dashboard</div>;
}

function renderRoute(route: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<RedirectIfAuthenticated />}>
        <Route path="/login" element={<Login />} />
      </Route>
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>,
    { route },
  );
}

describe("RedirectIfAuthenticated", () => {
  it("renders the outlet when not authenticated", () => {
    renderRoute("/login");
    expect(screen.getByText("página de login")).toBeInTheDocument();
  });

  it("redirects to dashboard when authenticated", () => {
    signInAs();
    renderRoute("/login");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
    expect(screen.queryByText("página de login")).not.toBeInTheDocument();
  });
});
