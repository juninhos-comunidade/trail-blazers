import { BrowserRouter, Route, Routes } from "react-router-dom";

import { LandingPage } from "./pages/LandingPage";
import { UnderConstructionPage } from "./pages/UnderConstructionPage";
import { ThemeProvider } from "./theme/ThemeProvider";
import { paths } from "./routes/paths";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path={paths.landing} element={<LandingPage />} />
          <Route path={paths.inProgress} element={<UnderConstructionPage />} />
          <Route path="*" element={<UnderConstructionPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
