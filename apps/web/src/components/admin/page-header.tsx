import type { ReactNode } from "react";
import { WorkspaceHero, type WorkspaceHeroMetric } from "./workspace-hero";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  note,
  metrics,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  note?: string;
  metrics?: WorkspaceHeroMetric[];
}) {
  return (
    <WorkspaceHero
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
      note={note}
      metrics={metrics}
    />
  );
}
