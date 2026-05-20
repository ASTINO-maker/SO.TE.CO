import { Card, CardContent, CardHeader } from "./ui/card";

export function MetricCard({
  label,
  value,
  trend,
  tone = "neutral",
}: {
  label: string;
  value: string;
  trend?: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  const toneStyles = {
    neutral: "bg-slate-500",
    positive: "bg-emerald-500",
    warning: "bg-amber-500",
  };

  return (
    <Card className="rounded-[1.75rem] border-[#ddd3c3] bg-[#fffdfa] shadow-[0_22px_52px_rgba(31,41,55,0.06)]">
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneStyles[tone]}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <strong className="block break-words text-[clamp(1.55rem,2.2vw,2.2rem)] leading-tight tracking-[-0.04em] text-slate-900">
          {value}
        </strong>
        {trend ? <span className="block break-words text-sm leading-6 text-slate-500">{trend}</span> : null}
      </CardContent>
    </Card>
  );
}
