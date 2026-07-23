import { Link, useLocation, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { GitHubSignInButton } from "../components/auth/GitHubSignInButton";
import { Alert } from "../components/ui/Alert";
import { LogoMark } from "../components/ui/Logo";
import { LockIcon } from "../components/ui/icons";
import { buttonStyles } from "../components/ui/button-styles";
import { authErrorMessage } from "../auth/auth-errors";
import { paths } from "../routes/paths";

interface LoginLocationState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { sessionEndReason } = useAuth();

  const state = location.state as LoginLocationState | null;
  const redirectTo = state?.from?.pathname;

  const message =
    authErrorMessage(searchParams.get("erro")) ??
    sessionEndMessage(sessionEndReason);

  return (
    <div className="flex min-h-screen animate-rise items-center justify-center bg-[radial-gradient(800px_400px_at_50%_-10%,--alpha(var(--color-trail-500)/13%),transparent_70%)] p-6">
      <div className="w-full max-w-[400px] rounded-xl border border-border bg-surface px-8 py-10 text-center shadow-lg">
        <div className="mb-4 flex justify-center">
          <LogoMark size={44} />
        </div>

        <h1 className="mb-1.5 font-display text-2xl font-semibold tracking-[-0.02em]">
          Entrar no Interview<span className="text-trail-text">Trail</span>
        </h1>
        <p className="mb-7 text-[14.5px] text-fg-2">
          Sua preparação começa com o seu código.
        </p>

        {message && <Alert className="mb-5">{message}</Alert>}

        <GitHubSignInButton redirectTo={redirectTo} className="w-full" />

        <p className="mt-4.5 flex items-start gap-2 text-left text-[13px] leading-[1.5] text-fg-2">
          <LockIcon className="mt-[3px] flex-none text-trail-text" />
          Acessamos apenas os repositórios que você escolher. Nada é publicado
          em seu nome.
        </p>

        <div className="mt-6 mb-4 h-px bg-border" />

        <Link
          to={paths.landing}
          className={buttonStyles("ghost", "sm", "font-medium")}
        >
          ← Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function sessionEndMessage(reason: string | null) {
  switch (reason) {
    case "expired":
      return "Sua sessão expirou por segurança. Entre novamente para continuar de onde parou.";
    case "invalid":
      return "Não foi possível validar sua sessão. Tente entrar novamente.";
    default:
      return null;
  }
}
