import { useAppLanguage } from "@/lib/app-language";
import { getStepText } from "@/lib/ui-text";

type AuthFlowStepProps = {
  step: 1 | 2 | 3;
  total?: 3;
  title: string;
  description: string;
};

export function AuthFlowStep({
  step,
  total = 3,
  title,
  description,
}: AuthFlowStepProps) {
  const { language } = useAppLanguage();

  return (
    <div className="mb-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-saathi-forest">
        {getStepText(language, step, total)}
      </p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-saathi-ink sm:text-3xl">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-saathi-ink/70">
        {description}
      </p>
    </div>
  );
}
