import { ButtonLink } from "../ui/Button";
import { GitHubIcon } from "../ui/icons";
import { paths } from "../../routes/paths";

export function FinalCtaSection() {
  return (
    <section className="border-t border-border bg-[radial-gradient(700px_300px_at_50%_120%,--alpha(var(--color-trail-500)/12%),transparent_70%)]">
      <div className="mx-auto max-w-[720px] px-6 py-22 text-center">
        <h2 className="mb-3.5 font-display text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-0.02em] text-pretty">
          Descubra suas lacunas antes do recrutador.
        </h2>
        <p className="mb-7.5 text-fg-2">
          Grátis para começar. A primeira entrevista leva uns vinte minutos.
        </p>
        <ButtonLink to={paths.login} size="lg" className="px-6.5">
          <GitHubIcon size={18} />
          Entrar com GitHub
        </ButtonLink>
      </div>
    </section>
  );
}
