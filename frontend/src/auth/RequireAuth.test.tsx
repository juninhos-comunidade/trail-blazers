import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { RequireAuth } from "./RequireAuth";
import { renderWithProviders, screen, signInAs } from "../test/render";

function Protected() {
  return <div>conteúdo protegido</div>;
}

function Login() {
  return <div>página de login</div>;
}

function renderRoute(route: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/protegido" element={<Protected />} />
      </Route>
      <Route path="/login" element={<Login />} />
    </Routes>,
    { route },
  );
}

describe("RequireAuth", () => {
  it("redirects to /login when not authenticated", () => {
    renderRoute("/protegido");
    expect(screen.getByText("página de login")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
  });

  it("renders the outlet when authenticated", () => {
    signInAs();
    renderRoute("/protegido");
    expect(screen.getByText("conteúdo protegido")).toBeInTheDocument();
  });
});
