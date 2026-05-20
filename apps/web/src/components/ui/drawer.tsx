import type { PropsWithChildren } from "react";
import { cn } from "../../lib/utils";

export function DrawerShell({
  open,
  title,
  description,
  children,
  panelClassName,
  bodyClassName,
}: PropsWithChildren<{
  open?: boolean;
  title: string;
  description?: string;
  panelClassName?: string;
  bodyClassName?: string;
}>) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-black/40 backdrop-blur-sm">
      <div
        className={cn(
          "flex h-full min-h-0 w-full max-w-xl flex-col overflow-hidden border-l border-border bg-card shadow-panel",
          panelClassName,
        )}
      >
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto p-6", bodyClassName)}>{children}</div>
      </div>
    </div>
  );
}
