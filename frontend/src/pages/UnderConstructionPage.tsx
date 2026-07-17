import { ButtonLink } from "../components/ui/Button";
import { Eyebrow } from "../components/ui/Eyebrow";
import { LogoMark } from "../components/ui/Logo";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { paths } from "../routes/paths";

export function UnderConstructionPage() {
  return (
    <div className="flex min-h-screen animate-rise flex-col items-center justify-center bg-[radial-gradient(800px_400px_at_50%_-10%,--alpha(var(--color-trail-500)/13%),transparent_70%)] p-6">
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-10 text-center shadow-lg">
        <div className="mb-4 flex justify-center">
          <LogoMark size={44} />
        </div>

        <Eyebrow tone="ember">Em desenvolvimento</Eyebrow>

        <h1 className="mt-3 mb-1.5 font-display text-2xl font-semibold tracking-[-0.02em]">
          Esta etapa da trilha ainda está sendo construída.
        </h1>
        <p className="mb-7 text-[14.5px] text-fg-2">
          Ainda não chegamos aqui. Enquanto isso, a landing page conta como o
          InterviewTrail vai funcionar.
        </p>

        <ButtonLink to={paths.landing} size="lg" className="w-full">
          Voltar ao início
        </ButtonLink>

        <div className="my-6 h-px bg-border" />
        <ThemeToggle />
      </div>
    </div>
  );
}
