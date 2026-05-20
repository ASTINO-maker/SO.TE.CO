import type { ReactNode } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function AdminEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-dashed border-[#d6ccb9] bg-[#fffaf4] px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f1e7d7] text-slate-500">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-5 flex items-center justify-center">{action}</div> : null}
    </div>
  );
}

export function AdminLoadingState({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-[#ddd3c3] bg-[#fffdfa] p-6 text-sm text-slate-500 shadow-[0_18px_40px_rgba(31,41,55,0.05)]",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </span>
    </div>
  );
}
