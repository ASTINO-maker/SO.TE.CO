import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { DialogShell } from "../ui/dialog";
import { DrawerShell } from "../ui/drawer";

export interface ActionPanelField {
  label: string;
  value: string;
}

export function ActionPanel({
  open,
  kind = "drawer",
  title,
  description,
  closeHref,
  primaryLabel = "Enregistrer le brouillon",
  fields = [],
  children,
}: {
  open: boolean;
  kind?: "drawer" | "dialog";
  title: string;
  description?: string;
  closeHref: string;
  primaryLabel?: string;
  fields?: ActionPanelField[];
  children?: ReactNode;
}) {
  const Shell = kind === "dialog" ? DialogShell : DrawerShell;

  return (
    <Shell open={open} title={title} description={description}>
      <div className="grid gap-5">
        {fields.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="rounded-2xl border border-black/6 bg-[#fcfbf8] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{field.label}</p>
                <p className="mt-2 text-sm font-medium text-slate-700">{field.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {children ? <div className="grid gap-3 text-sm leading-6 text-muted-foreground">{children}</div> : null}

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href={closeHref}>Fermer</Link>
          </Button>
          <Button asChild>
            <Link href={closeHref}>{primaryLabel}</Link>
          </Button>
        </div>
      </div>
    </Shell>
  );
}
