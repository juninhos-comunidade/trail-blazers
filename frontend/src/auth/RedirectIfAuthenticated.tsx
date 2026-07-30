import { Navigate, Outlet } from "react-router-dom";

import { paths } from "../routes/paths";
import { useAuth } from "./useAuth";

/** RF-1.3: quem já está autenticado não precisa ver a tela de login. */
export function RedirectIfAuthenticated() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={paths.dashboard} replace={true} />;
  }

  return <Outlet />;
}
