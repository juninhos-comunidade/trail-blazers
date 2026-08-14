import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { consumeRedirectAfterLogin, exchangeLoginCode } from "../auth/github-oauth";
import { useAuth } from "../auth/useAuth";
import { Spinner } from "../components/ui/Spinner";
import { paths } from "../routes/paths";

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  const code = searchParams.get("code");
  const error = searchParams.get("error");

  useEffect(() => {
    if (handled.current) {
      return;
    }
    handled.current = true;

    const goToLogin = (reason: string) =>
      navigate(`${paths.login}?erro=${encodeURIComponent(reason)}`, {
        replace: true,
      });

    if (error) {
      goToLogin(error);
      return;
    }

    if (!code) {
      goToLogin("sem_token");
      return;
    }

    exchangeLoginCode(code)
      .then((token) => {
        if (!signIn(token)) {
          goToLogin("token_invalido");
          return;
        }

        navigate(consumeRedirectAfterLogin() ?? paths.dashboard, { replace: true });
      })
      .catch(() => goToLogin("token_invalido"));
  }, [error, code, signIn, navigate]);

  return (
    <div className="flex min-h-screen animate-rise flex-col items-center justify-center gap-5 p-6 text-center">
      <Spinner label="Conectando ao GitHub" />
      <p className="font-mono text-sm text-fg">Conectando ao GitHub…</p>
      <p className="text-[13.5px] text-fg-muted">
        Autenticando e listando os repositórios autorizados.
      </p>
    </div>
  );
}
