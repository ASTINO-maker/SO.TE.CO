"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

type HealthStatus = "checking" | "online" | "offline";

const HEALTH_ENDPOINT = "/api/v1/health";
const POLL_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;

async function ping(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(HEALTH_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function HealthBadge({ isDark = false }: { isDark?: boolean }) {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!cancelled) setStatus((current) => (current === "checking" ? "checking" : current));
      const ok = await ping();
      if (cancelled) return;
      setStatus(ok ? "online" : "offline");
      setLastCheckedAt(new Date());
    };

    void check();
    const interval = window.setInterval(check, POLL_INTERVAL_MS);

    const handleOnline = () => void check();
    const handleOffline = () => setStatus("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const label =
    status === "online" ? "API en ligne" : status === "offline" ? "API hors ligne" : "Vérification…";
  const lastChecked = lastCheckedAt ? lastCheckedAt.toLocaleTimeString("fr-FR") : null;
  const tooltip = lastChecked ? `${label} • dernière vérification ${lastChecked}` : label;

  const dotClass =
    status === "online"
      ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
      : status === "offline"
      ? "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]"
      : "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]";

  const Icon =
    status === "online" ? Wifi : status === "offline" ? WifiOff : Loader2;

  return (
    <div
      title={tooltip}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-xl border px-2.5 text-xs font-medium",
        isDark
          ? "border-white/10 bg-[#162233] text-slate-200"
          : "border-[#d9ccb8] bg-white/95 text-slate-700",
      )}
      role="status"
      aria-live="polite"
    >
      <span className={cn("inline-flex h-2.5 w-2.5 rounded-full", dotClass)} aria-hidden />
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          status === "checking" && "animate-spin",
          status === "online" && "text-emerald-500",
          status === "offline" && "text-rose-500",
        )}
        aria-hidden
      />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
