"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export type ActionToastTone = "default" | "success" | "danger";

export interface ActionToastPayload {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  tone?: ActionToastTone;
}

export function useActionToast() {
  const [toast, setToast] = useState<ActionToastPayload | null>(null);

  useEffect(() => {
    if (!toast || !toast.durationMs || toast.durationMs <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, toast.durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const showToast = useCallback((nextToast: ActionToastPayload) => {
    setToast(nextToast);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    toast,
    showToast,
    dismissToast,
  };
}

export function ActionToast({
  toast,
  onClose,
}: {
  toast: ActionToastPayload | null;
  onClose: () => void;
}) {
  if (!toast) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex justify-end sm:inset-x-6">
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl",
          toast.tone === "danger" && "border-rose-200 bg-rose-50 text-rose-800",
          toast.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
          (!toast.tone || toast.tone === "default") && "border-black/8 bg-white text-slate-700",
        )}
      >
        <p className="min-w-0 flex-1 text-sm">{toast.message}</p>
        {toast.actionLabel && toast.onAction ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-xl px-3"
            onClick={toast.onAction}
          >
            {toast.actionLabel}
          </Button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-700"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
