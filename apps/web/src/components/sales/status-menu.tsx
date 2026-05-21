"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface StatusOption {
  value: string;
  label: string;
  description?: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}

interface StatusMenuProps {
  current: string;
  currentLabel?: string;
  options: StatusOption[];
  disabled?: boolean;
  onSelect: (next: string) => void | Promise<void>;
  align?: "start" | "end";
  buttonClassName?: string;
  label?: string;
}

const toneClass: Record<NonNullable<StatusOption["tone"]>, string> = {
  neutral: "text-slate-700 hover:bg-slate-100",
  positive: "text-emerald-700 hover:bg-emerald-50",
  warning: "text-amber-700 hover:bg-amber-50",
  danger: "text-rose-700 hover:bg-rose-50",
};

export function StatusMenu({
  current,
  currentLabel,
  options,
  disabled,
  onSelect,
  align = "end",
  buttonClassName,
  label = "Statut",
}: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const availableOptions = options.filter((option) => option.value !== current);
  const hasOptions = availableOptions.length > 0;

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled || !hasOptions}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50",
          buttonClassName,
        )}
        title={hasOptions ? `Changer le statut (actuellement ${currentLabel ?? current})` : "Aucune transition disponible"}
      >
        <span className="uppercase tracking-wide">{label}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && hasOptions ? (
        <div
          className={cn(
            "absolute top-10 z-20 min-w-[220px] rounded-2xl border border-black/10 bg-white p-1 shadow-xl",
            align === "end" ? "right-0" : "left-0",
          )}
          role="menu"
        >
          {availableOptions.map((option) => {
            const tone = option.tone ?? "neutral";
            return (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void onSelect(option.value);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  toneClass[tone],
                )}
              >
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
