import { ButtonLink } from "../ui/Button";
import { buttonStyles } from "../ui/button-styles";
import { Container } from "../ui/Container";
import { Logo } from "../ui/Logo";
import { ThemeToggle } from "../ui/ThemeToggle";
import { GitHubIcon } from "../ui/icons";
import { paths, sectionIds } from "../../routes/paths";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur-[10px]">
      <Container className="flex items-center justify-between gap-4 py-3.5">
        <Logo />

        <nav className="flex items-center gap-2.5">
          <a
            href={`#${sectionIds.howItWorks}`}
            className={buttonStyles(
              "ghost",
              "sm",
              "hidden md:inline-flex font-medium",
            )}
          >
            Como funciona
          </a>

          <ThemeToggle />

          <ButtonLink
            to={paths.login}
            variant="secondary"
            size="sm"
            className="hidden md:inline-flex"
          >
            <GitHubIcon />
            Entrar
          </ButtonLink>
        </nav>
      </Container>
    </header>
  );
}
