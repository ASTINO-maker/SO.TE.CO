"use client";

import { useEffect, type PropsWithChildren } from "react";
import { cn } from "../../lib/utils";

export function DialogShell({
  open,
  title,
  description,
  children,
  panelClassName,
  bodyClassName,
  onClose,
  closeLabel = "Close dialog",
  isDirty = false,
  dirtyWarningText = "You have unsaved changes. Close this dialog anyway?",
}: PropsWithChildren<{
  open?: boolean;
  title: string;
  description?: string;
  panelClassName?: string;
  bodyClassName?: string;
  onClose?: () => void;
  closeLabel?: string;
  isDirty?: boolean;
  dirtyWarningText?: string;
}>) {
  const closeDialog = onClose;

  function requestClose() {
    if (!closeDialog) {
      return;
    }

    if (isDirty && !window.confirm(dirtyWarningText)) {
      return;
    }

    closeDialog();
  }

  useEffect(() => {
    if (!open || !closeDialog) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, closeDialog, isDirty, dirtyWarningText]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={requestClose}
    >
      <div
        className={cn(
          "flex max-h-[min(92vh,1100px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel",
          panelClassName,
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={requestClose}
              aria-label={closeLabel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-lg leading-none text-muted-foreground transition-colors hover:bg-muted"
            >
              x
            </button>
          ) : null}
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto p-6", bodyClassName)}>{children}</div>
      </div>
    </div>
  );
}
