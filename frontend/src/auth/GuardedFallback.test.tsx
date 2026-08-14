import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { GuardedFallback } from "./GuardedFallback";
import { renderWithProviders, screen, signInAs } from "../test/render";

function Landing() {
  return <div>landing page</div>;
}

function renderRoute(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<GuardedFallback />} />
    </Routes>,
    { route },
  );
}

describe("GuardedFallback", () => {
  it("redirects unauthenticated users to the landing page", () => {
    renderRoute("/rota-desconhecida");
    expect(screen.getByText("landing page")).toBeInTheDocument();
  });

  it("renders UnderConstructionPage for authenticated users", () => {
    signInAs();
    renderRoute("/rota-desconhecida");
    expect(screen.queryByText("landing page")).not.toBeInTheDocument();
  });
});
