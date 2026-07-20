import { Container } from "../ui/Container";
import { Logo } from "../ui/Logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <Container className="flex flex-wrap items-center justify-between gap-4 py-7">
        <Logo markSize={20} className="text-base" />
        <span className="font-mono text-xs text-fg-muted">
          Equipe Trail Blazers · protótipo v1 · 2026
        </span>
      </Container>
    </footer>
  );
}
