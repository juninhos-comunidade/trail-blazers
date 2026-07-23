import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import { RedirectIfAuthenticated } from "./auth/RedirectIfAuthenticated";
import { RequireAuth } from "./auth/RequireAuth";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { UnderConstructionPage } from "./pages/UnderConstructionPage";
import { ThemeProvider } from "./theme/ThemeProvider";
import { paths } from "./routes/paths";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path={paths.landing} element={<LandingPage />} />
            <Route path={paths.authCallback} element={<AuthCallbackPage />} />

            <Route element={<RedirectIfAuthenticated />}>
              <Route path={paths.login} element={<LoginPage />} />
            </Route>

            {/* Rotas privadas (RF-1.3). */}
            <Route element={<RequireAuth />}>
              <Route path={paths.dashboard} element={<DashboardPage />} />
            </Route>

            <Route
              path={paths.inProgress}
              element={<UnderConstructionPage />}
            />
            <Route path="*" element={<UnderConstructionPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
