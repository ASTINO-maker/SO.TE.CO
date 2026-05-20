import type { ReactNode } from "react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

export interface WorkspaceHeroMetric {
  label: string;
  value: string;
  tone?: "default" | "accent" | "success" | "warning";
}

export function WorkspaceHero({
  eyebrow,
  title,
  description,
  actions,
  note,
  metrics,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  note?: string;
  metrics?: WorkspaceHeroMetric[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-black/6 bg-white/95 p-6 shadow-[0_30px_80px_rgba(31,41,55,0.08)]",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(135deg,rgba(47,65,86,0.12),rgba(207,118,71,0.06),transparent)]" />
      <div className="absolute right-[-4rem] top-[-4rem] h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(207,118,71,0.18),transparent_68%)]" />

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)] xl:items-start">
        <div className="space-y-4">
          <Badge variant="outline" className="w-fit rounded-full border-black/8 bg-[#fff9f2] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-700">
            {eyebrow}
          </Badge>
          <div className="space-y-3">
            <h1 className="max-w-5xl text-[clamp(2rem,3vw,3.3rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-900">
              {title}
            </h1>
            <p className="max-w-4xl text-[15px] leading-7 text-slate-600">{description}</p>
          </div>
        </div>

        <div className="grid gap-3">
          {note ? (
            <div className="rounded-[1.5rem] border border-[#d8ccb7] bg-[#f7f1e5] p-4 text-sm leading-6 text-slate-700">
              {note}
            </div>
          ) : null}
          {actions ? <div className="flex flex-wrap gap-3 xl:justify-end">{actions}</div> : null}
        </div>
      </div>

      {metrics?.length ? (
        <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={`${metric.label}-${metric.value}`}
              className="rounded-[1.35rem] border border-black/6 bg-[#fcfaf6] px-4 py-4"
            >
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
              <p
                className={cn(
                  "mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-slate-900",
                  metric.tone === "accent" && "text-[#c45b2d]",
                  metric.tone === "success" && "text-emerald-700",
                  metric.tone === "warning" && "text-amber-700",
                )}
              >
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
