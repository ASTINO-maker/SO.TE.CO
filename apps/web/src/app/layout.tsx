import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LocaleProvider } from "../lib/locale";
import { ServiceWorkerRegister } from "../components/service-worker-register";

export const metadata: Metadata = {
  title: "SO.TE.CO ERP/CRM",
  description: "ERP/CRM admin workspace for a metal construction company.",
  manifest: "/manifest.webmanifest",
  applicationName: "SO.TE.CO",
  appleWebApp: {
    capable: true,
    title: "SO.TE.CO",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/brand/sotec-mark.jpg",
    apple: "/brand/sotec-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f4156",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
