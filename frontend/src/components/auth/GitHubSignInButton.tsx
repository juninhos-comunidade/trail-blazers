import { useState } from "react";

import { startGithubOAuth } from "../../auth/github-oauth";
import { Button } from "../ui/Button";
import { GitHubIcon } from "../ui/icons";
import type { ButtonSize } from "../ui/button-styles";

/**
 * Dispara o OAuth e trava o botão até a navegação sair — o redirect leva um
 * instante e o clique duplo mandaria duas autorizações para o GitHub.
 */
export function GitHubSignInButton({
  redirectTo,
  size = "lg",
  className,
  children = "Entrar com GitHub",
}: {
  redirectTo?: string;
  size?: ButtonSize;
  className?: string;
  children?: string;
}) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  return (
    <Button
      size={size}
      className={className}
      disabled={isRedirecting}
      onClick={() => {
        setIsRedirecting(true);
        startGithubOAuth(redirectTo);
      }}
    >
      <GitHubIcon size={18} />
      {isRedirecting ? "Redirecionando…" : children}
    </Button>
  );
}
