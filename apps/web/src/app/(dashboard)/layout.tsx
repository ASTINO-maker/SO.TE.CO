import type { PropsWithChildren } from "react";
import { AppShell } from "../../components/app-shell";

export default function DashboardLayout({ children }: PropsWithChildren) {
  return <AppShell>{children}</AppShell>;
}

