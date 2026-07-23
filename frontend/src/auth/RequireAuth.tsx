import { Navigate, Outlet, useLocation } from "react-router-dom";

import { paths } from "../routes/paths";
import { useAuth } from "./useAuth";

/**
 * RF-1.3: visitante em rota privada volta para o login. Guardamos a rota
 * pretendida para devolvê-lo a ela depois de autenticar.
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate to={paths.login} state={{ from: location }} replace={true} />
    );
  }

  return <Outlet />;
}
