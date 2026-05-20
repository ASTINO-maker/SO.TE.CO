"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "./button";
import { DialogShell } from "./dialog";

type ConfirmTone = "default" | "danger";

interface ConfirmDialogOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  open: boolean;
}

export function useConfirmDialog() {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [dialogState, setDialogState] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirmer",
    cancelLabel: "Annuler",
    tone: "default",
  });

  const closeDialog = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialogState((current) => ({ ...current, open: false }));
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        open: true,
        title: options.title,
        description: options.description ?? "",
        confirmLabel: options.confirmLabel ?? "Confirmer",
        cancelLabel: options.cancelLabel ?? "Annuler",
        tone: options.tone ?? "default",
      });
    });
  }, []);

  const confirmDialog = useMemo(
    () => (
      <DialogShell
        open={dialogState.open}
        title={dialogState.title}
        description={dialogState.description}
        panelClassName="max-w-[min(92vw,520px)]"
        onClose={() => closeDialog(false)}
        closeLabel="Fermer la confirmation"
      >
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" className="rounded-2xl" onClick={() => closeDialog(false)}>
            {dialogState.cancelLabel}
          </Button>
          <Button
            type="button"
            className={dialogState.tone === "danger" ? "rounded-2xl bg-[#a62626] hover:bg-[#8f1f1f]" : "rounded-2xl"}
            onClick={() => closeDialog(true)}
          >
            {dialogState.confirmLabel}
          </Button>
        </div>
      </DialogShell>
    ),
    [closeDialog, dialogState],
  );

  return {
    confirm,
    confirmDialog,
  };
}
