import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LocaleProvider } from "../lib/locale";

export const metadata: Metadata = {
  title: "SO.TE.CO ERP/CRM",
  description: "ERP/CRM admin workspace for a metal construction company.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
