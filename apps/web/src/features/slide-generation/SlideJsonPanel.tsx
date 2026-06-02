import { PanelCard } from "@/features/slide-generation/PanelCard";
import { useI18n } from "@/i18n";

interface SlideJsonPanelProps {
  slideDeck: unknown;
}

export function SlideJsonPanel({ slideDeck }: SlideJsonPanelProps) {
  const { t } = useI18n();
  return (
    <PanelCard title={t("json.heading")}>
      <pre className="scroll-area max-h-[420px] overflow-auto rounded-xl bg-[#0f1b17] p-4 font-mono text-xs leading-relaxed text-brand-100">
        {JSON.stringify(slideDeck, null, 2)}
      </pre>
    </PanelCard>
  );
}
