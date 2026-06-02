import type { ReactNode } from "react";

interface PanelCardProps {
  title: string;
  className?: string;
  children: ReactNode;
}

export function PanelCard({ title, className, children }: PanelCardProps) {
  return (
    <section
      className={`rounded-2xl border border-line bg-panel p-5 shadow-sm ${className ?? ""}`}
    >
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-700">{title}</h3>
      {children}
    </section>
  );
}

export function DefinitionRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/70 py-1.5 last:border-0">
      <dt className="text-sm text-ink-soft">{term}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

export function IssueList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="mt-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-accent-600">{label}</h4>
      <ul className="mt-1.5 space-y-1">
        {items.map((item, index) => (
          <li
            key={`${label}-${index}`}
            className="flex gap-2 text-sm text-ink-soft before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-accent-500"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
