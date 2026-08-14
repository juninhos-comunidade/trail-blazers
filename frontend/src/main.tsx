import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { bootDemo } from "./demo/demo-boot";
import "./index.css";

// Precisa rodar antes do React montar: troca o fetch pelo backend falso e
// deixa a sessão "logada" antes do AuthProvider ler o token.
bootDemo();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
