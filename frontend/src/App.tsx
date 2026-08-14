import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import { GuardedFallback } from "./auth/GuardedFallback";
import { RedirectIfAuthenticated } from "./auth/RedirectIfAuthenticated";
import { RequireAuth } from "./auth/RequireAuth";
import { InterviewFlowLayout } from "@components/app/InterviewFlowLayout";
import { DemoAutopilot } from "./demo/DemoAutopilot";
import { DEMO_MODE } from "./demo/demo-flag";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { InterviewPage } from "@pages/InterviewPage";
import { JobDescriptionPage } from "@pages/JobDescriptionPage";
import { ReportPage } from "@pages/ReportPage";
import { RepositoryChooserPage } from "@pages/RepositoryChooserPage";
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

            <Route element={<RequireAuth />}>
              <Route path={paths.dashboard} element={<DashboardPage />} />

              <Route element={<InterviewFlowLayout />}>
                <Route path={`${paths.newInterview}/:sessionId?`} element={<JobDescriptionPage />} />
                <Route path={`${paths.repoChooser}/:sessionId?`} element={<RepositoryChooserPage />} />
                <Route path={`${paths.interview}/:sessionId?`} element={<InterviewPage />} />
                <Route path={`${paths.report}/:sessionId?`} element={<ReportPage />} />
              </Route>
            </Route>

            <Route path="*" element={<GuardedFallback />} />
          </Routes>

          {DEMO_MODE && <DemoAutopilot />}
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
