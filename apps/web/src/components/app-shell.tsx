"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Command,
  FileText,
  Folder,
  Hammer,
  Home,
  KeyRound,
  LogOut,
  Moon,
  Receipt,
  Search,
  Settings,
  Shield,
  Sun,
  Truck,
  UserPlus,
  Users,
  Wallet,
  Coins,
} from "lucide-react";
import { usePersistedState } from "../lib/use-persisted-state";
import { HealthBadge } from "./health-badge";
import { apiClient } from "../lib/api/client";
import { getNavigationSections, type IconKey } from "../lib/navigation";
import { companyBrand } from "../lib/branding";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { useLocale } from "../lib/locale";

const iconMap: Record<IconKey, typeof Home> = {
  home: Home,
  users: Users,
  "user-plus": UserPlus,
  "file-text": FileText,
  receipt: Receipt,
  truck: Truck,
  hammer: Hammer,
  wallet: Wallet,
  coins: Coins,
  folder: Folder,
  shield: Shield,
  "key-round": KeyRound,
  settings: Settings,
};

type ThemeMode = "light" | "dark";

interface ShellNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
}

interface ShellPrincipal {
  fullName: string;
  email: string;
}

const initialNotifications: ShellNotification[] = [];

interface ShellCommand {
  id: string;
  title: string;
  description: string;
  section: string;
  icon: typeof Home;
  keywords: string;
  run: () => void;
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLocale();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [themeMode, setThemeMode] = usePersistedState<ThemeMode>("sotec.theme", "light");
  const [notifications, setNotifications] = usePersistedState<ShellNotification[]>(
    "sotec.notifications",
    initialNotifications,
  );
  const [authState, setAuthState] = useState<"checking" | "ready">("checking");
  const [principal, setPrincipal] = useState<ShellPrincipal | null>(null);

  const isDark = themeMode === "dark";
  const unreadCount = notifications.filter((item) => item.unread).length;
  const navigationSections = getNavigationSections(locale);
  const navigationItems = useMemo(
    () =>
      navigationSections.flatMap((section) =>
        section.items.map((item) => ({
          ...item,
          sectionTitle: section.title,
        })),
      ),
    [navigationSections],
  );
  const currentNavigationItem = useMemo(
    () =>
      [...navigationItems]
        .sort((left, right) => right.href.length - left.href.length)
        .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)),
    [navigationItems, pathname],
  );
  const currentDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [locale],
  );
  const ownerInitials =
    principal?.fullName
      ?.split(" ")
      .map((chunk) => chunk[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "A";
  const createCommandItems = useMemo<ShellCommand[]>(
    () => [
      {
        id: "create-client",
        title: "Creer un client",
        description: "Ouvrir directement le formulaire de creation CRM.",
        section: "Creer",
        icon: Users,
        keywords: "creer client crm nouveau fiche",
        run: () => {
          setCommandOpen(false);
          router.push("/crm/clients?action=new");
        },
      },
      {
        id: "create-lead",
        title: "Creer un prospect",
        description: "Ouvrir le formulaire de creation de prospect CRM.",
        section: "Creer",
        icon: UserPlus,
        keywords: "creer prospect lead crm nouveau",
        run: () => {
          setCommandOpen(false);
          router.push("/crm/leads?action=new");
        },
      },
      {
        id: "create-quotation",
        title: "Creer un devis",
        description: "Ouvrir le brouillon de devis dans l'espace ventes.",
        section: "Creer",
        icon: FileText,
        keywords: "creer devis quotation sales nouveau",
        run: () => {
          setCommandOpen(false);
          router.push("/sales/quotations?action=new");
        },
      },
      {
        id: "create-invoice",
        title: "Creer une facture",
        description: "Ouvrir le brouillon de facture dans l'espace ventes.",
        section: "Creer",
        icon: Receipt,
        keywords: "creer facture invoice sales nouveau",
        run: () => {
          setCommandOpen(false);
          router.push("/sales/invoices?action=new");
        },
      },
      {
        id: "create-delivery-note",
        title: "Creer un bon de livraison",
        description: "Ouvrir un nouveau bon de livraison dans l'espace ventes.",
        section: "Creer",
        icon: Truck,
        keywords: "creer bon livraison delivery note sales nouveau",
        run: () => {
          setCommandOpen(false);
          router.push("/sales/delivery-notes?action=new");
        },
      },
      {
        id: "create-project",
        title: "Creer un chantier",
        description: "Ouvrir directement le formulaire de creation chantier.",
        section: "Creer",
        icon: Hammer,
        keywords: "creer chantier project operations nouveau",
        run: () => {
          setCommandOpen(false);
          router.push("/operations/projects?action=new");
        },
      },
    ],
    [router],
  );
  const commandItems = useMemo<ShellCommand[]>(
    () => [
      ...navigationItems.map((item) => ({
        id: `nav-${item.href}`,
        title: item.title,
        description: item.description,
        section: item.sectionTitle,
        icon: iconMap[item.icon],
        keywords: `${item.title} ${item.description} ${item.sectionTitle} ${item.href}`,
        run: () => {
          setCommandOpen(false);
          router.push(item.href);
        },
      })),
      ...createCommandItems,
      {
        id: "utility-theme",
        title: isDark ? "Passer en mode clair" : "Passer en mode sombre",
        description: "Changer le theme global de l'interface.",
        section: "Raccourcis",
        icon: isDark ? Sun : Moon,
        keywords: "theme mode sombre clair apparence",
        run: () => {
          setThemeMode((current) => (current === "dark" ? "light" : "dark"));
          setCommandOpen(false);
        },
      },
      {
        id: "utility-read-notifications",
        title: "Marquer toutes les notifications comme lues",
        description: "Nettoyer le centre de notifications.",
        section: "Raccourcis",
        icon: CheckCheck,
        keywords: "notifications lu unread",
        run: () => {
          markAllNotificationsRead();
          setCommandOpen(false);
        },
      },
      {
        id: "utility-logout",
        title: "Se deconnecter",
        description: "Fermer la session active et revenir a la page de connexion.",
        section: "Raccourcis",
        icon: LogOut,
        keywords: "logout deconnexion session",
        run: () => {
          void handleSignOut();
          setCommandOpen(false);
        },
      },
    ],
    [navigationItems, createCommandItems, router, isDark],
  );
  const filteredCommands = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) {
      return commandItems;
    }

    return commandItems.filter((item) => item.keywords.toLowerCase().includes(query));
  }, [commandItems, commandQuery]);
  const primaryCommand = filteredCommands[0];
  const text = {
    checkingSession: "Vérification de la session...",
    workspaceOwner: "Propriétaire",
    authenticatedSession: "Session authentifiée",
    signedIn: "Connecté",
    active: "Active",
    signOut: "Déconnexion",
    admin: "Admin",
    operationsWorkspace: "Espace d'exploitation",
    searchPlaceholder: "Rechercher clients, devis, factures...",
    switchTheme: `Passer en mode ${isDark ? "clair" : "sombre"}`,
    notifications: "Notifications",
    allCaughtUp: "Tout est à jour",
    unreadUpdates: `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`,
    markAllRead: "Tout marquer lu",
    noUnread: "Aucune notification non lue.",
    liveWorkspace: "Installation locale",
    commandPalette: "Commande rapide",
    commandHint: "Ctrl K",
    commandSearchPlaceholder: "Aller vers un module ou lancer une action...",
    noCommandResults: "Aucun resultat, essayez un autre mot-cle.",
    adminArea: "ERP SO.TE.CO",
    home: "Accueil",
    workspace: "Poste de gestion",
  };

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, []);

  useEffect(() => {
    if (!commandOpen) {
      setCommandQuery("");
      return;
    }

    setNotificationsOpen(false);
  }, [commandOpen]);

  useEffect(() => {
    let cancelled = false;

    async function ensureAuthenticated() {
      if (!apiClient.hasSession()) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
        return;
      }

      try {
        const user = await apiClient.me();
        if (!cancelled) {
          if (user.requiresPasswordChange || user.workspaceSetupRequired) {
            router.replace("/setup");
            return;
          }

          setPrincipal({
            fullName: user.fullName,
            email: user.email,
          });
          setAuthState("ready");
        }
      } catch {
        apiClient.clearSession();
        if (!cancelled) {
          router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
        }
      }
    }

    void ensureAuthenticated();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  function markNotificationRead(id: string) {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: false } : item)),
    );
  }

  function markAllNotificationsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
  }

  function toggleTheme() {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
    setNotificationsOpen(false);
  }

  async function handleSignOut() {
    await apiClient.logout();
    router.replace("/login");
  }

  if (authState === "checking") {
    return (
      <div className={cn("flex min-h-screen items-center justify-center", isDark ? "bg-[#0f1724]" : "bg-[#f5f1e8]")}>
          <div className="rounded-[1.75rem] border border-black/6 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          {text.checkingSession}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen overflow-x-clip lg:grid lg:grid-cols-[272px_minmax(0,1fr)]",
        isDark ? "bg-[#0f1724]" : "bg-[#f7f2e8]",
      )}
    >
      <aside
        className={cn(
          "hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:min-h-0 lg:flex-col lg:border-r text-slate-100",
          isDark ? "border-white/5 bg-[#101825]" : "border-[#d8ccb7] bg-[#16202d]",
        )}
      >
        <div className="border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/95 p-1 shadow-[0_12px_24px_rgba(0,0,0,0.14)]">
              <Image
                src={companyBrand.logoPath}
                alt={companyBrand.name}
                width={84}
                height={84}
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-semibold tracking-tight">{companyBrand.name}</p>
              <p className="truncate text-xs text-slate-400">{companyBrand.subtitle}</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{currentDateLabel}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-4 px-3 py-3" aria-label="Primary">
          {navigationSections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <p className="px-2.5 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = iconMap[item.icon];
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-[1rem] px-2.5 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-[#223247] text-white shadow-[0_16px_30px_rgba(9,14,22,0.24)]"
                          : "text-slate-300 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {isActive ? <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[#ff8b5e]" /> : null}
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors",
                          isActive
                            ? "border-white/10 bg-white/10 text-white"
                            : "border-transparent bg-white/5 text-slate-400 group-hover:text-slate-200",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.title}</p>
                      </div>
                      {item.badge ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            isActive ? "bg-white/10 text-slate-100" : "bg-white/8 text-slate-400",
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-[1.1rem] bg-[#0d1420] px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff6b5b] text-sm font-semibold text-white">
              {ownerInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{principal?.fullName ?? text.workspaceOwner}</p>
              <p className="truncate text-xs text-slate-400">{principal?.email ?? text.authenticatedSession}</p>
            </div>
            <Badge
              variant="outline"
              className="hidden rounded-full border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300 xl:inline-flex"
            >
              {text.active}
            </Badge>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
              aria-label={text.signOut}
              title={text.signOut}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 min-h-screen">
        <header
          className={cn(
            "sticky top-0 z-30 border-b px-5 py-4 backdrop-blur sm:px-6 lg:px-8",
            isDark ? "border-white/5 bg-[#0f1724]/90" : "border-black/5 bg-[#f7f2e8]/90",
          )}
        >
          <div className="mx-auto w-full max-w-[1600px]">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className={cn("flex flex-wrap items-center gap-1 text-xs", isDark ? "text-slate-500" : "text-slate-400")}>
                  <span>{text.home}</span>
                  {currentNavigationItem && currentNavigationItem.href !== "/dashboard" ? (
                    <>
                      <ChevronRight className="h-3.5 w-3.5" />
                      <span>{currentNavigationItem.sectionTitle}</span>
                    </>
                  ) : null}
                </div>
                <h1 className={cn("mt-1 text-[clamp(1.7rem,2.2vw,2.35rem)] font-semibold tracking-[-0.04em]", isDark ? "text-slate-100" : "text-slate-900")}>
                  {currentNavigationItem?.title ?? text.workspace}
                </h1>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCommandOpen(true)}
                    className={cn(
                      "group flex h-12 min-w-[280px] items-center gap-3 rounded-[1.4rem] border px-4 text-left shadow-sm transition-all sm:min-w-[360px]",
                      isDark
                        ? "border-white/10 bg-[#162233] text-slate-100 hover:bg-[#1b2b40]"
                        : "border-[#d9ccb8] bg-white/95 text-slate-800 hover:border-[#ccb89a] hover:bg-white",
                    )}
                    title={text.commandPalette}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        isDark ? "bg-white/10 text-slate-300" : "bg-[#f6efe3] text-[#9f6b3f]",
                      )}
                    >
                      <Search className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700")}>
                        Rechercher un module ou lancer une action
                      </p>
                      <p className={cn("truncate text-[11px]", isDark ? "text-slate-500" : "text-slate-400")}>
                        Clients, devis, factures, chantiers, paiements
                      </p>
                    </div>
                    <div className="hidden items-center gap-1.5 sm:flex">
                      <span
                        className={cn(
                          "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                          isDark ? "border-white/10 bg-white/5 text-slate-400" : "border-[#e3d6c4] bg-[#fcf8f1] text-slate-500",
                        )}
                      >
                        {text.commandHint}
                      </span>
                    </div>
                  </button>
                  <HealthBadge isDark={isDark} />
                  <div
                    className={cn(
                      "relative flex h-12 items-center gap-1 rounded-[1.4rem] border px-1.5 shadow-sm",
                      isDark ? "border-white/10 bg-[#162233]" : "border-[#d9ccb8] bg-white/95",
                    )}
                  >
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                      isDark
                        ? "text-slate-300 hover:bg-white/10"
                        : "text-slate-500 hover:bg-[#f6efe3]",
                    )}
                    aria-label={text.switchTheme}
                    title={text.switchTheme}
                  >
                    {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationsOpen((current) => !current);
                    }}
                    className={cn(
                      "relative inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                      isDark
                        ? "text-slate-300 hover:bg-white/10"
                        : "text-slate-500 hover:bg-[#f6efe3]",
                    )}
                    aria-label={text.notifications}
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" /> : null}
                  </button>
                  </div>

                  {notificationsOpen ? (
                    <div
                      className={cn(
                        "absolute right-0 top-14 z-40 w-[360px] rounded-[1.25rem] border p-3 shadow-xl",
                        isDark ? "border-white/10 bg-[#162233]" : "border-black/8 bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 px-2 py-1">
                        <div>
                          <p className={cn("text-sm font-semibold", isDark ? "text-slate-100" : "text-slate-800")}>{text.notifications}</p>
                          <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                            {unreadCount ? text.unreadUpdates : text.allCaughtUp}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium",
                            isDark ? "bg-[#1f2d3f] text-slate-200" : "bg-[#f7f1e7] text-slate-700",
                          )}
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          {text.markAllRead}
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {notifications.length ? (
                          notifications.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => markNotificationRead(item.id)}
                              className={cn(
                                "rounded-2xl border px-3 py-3 text-left transition-colors",
                                isDark
                                  ? "border-white/8 bg-[#111926] hover:bg-[#1b2b40]"
                                  : "border-black/6 bg-[#fcfbf8] hover:bg-[#f8f3ea]",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className={cn("text-sm font-semibold", isDark ? "text-slate-100" : "text-slate-800")}>{item.title}</p>
                                  <p className={cn("mt-1 text-xs leading-5", isDark ? "text-slate-400" : "text-slate-500")}>{item.description}</p>
                                  <p className={cn("mt-2 text-[11px]", isDark ? "text-slate-500" : "text-slate-400")}>{item.time}</p>
                                </div>
                                {item.unread ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-rose-500" /> : null}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div
                            className={cn(
                              "rounded-2xl border px-3 py-6 text-center text-sm",
                              isDark ? "border-white/8 bg-[#111926] text-slate-400" : "border-black/6 bg-[#fcfbf8] text-slate-500",
                            )}
                          >
                            {text.noUnread}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

      {commandOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-24 backdrop-blur-sm"
          onMouseDown={() => setCommandOpen(false)}
        >
          <div
            className={cn(
              "w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl",
              isDark ? "border-white/10 bg-[#101a29]" : "border-black/8 bg-white",
            )}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={cn("border-b px-4 py-4", isDark ? "border-white/10" : "border-black/8")}>
              <div className="flex items-center gap-2">
                <Command className={cn("h-4 w-4", isDark ? "text-slate-300" : "text-slate-600")} />
                <p className={cn("text-sm font-semibold", isDark ? "text-slate-100" : "text-slate-800")}>{text.commandPalette}</p>
                <span
                  className={cn(
                    "ml-auto rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
                    isDark ? "border-white/10 text-slate-400" : "border-black/8 text-slate-400",
                  )}
                >
                  {text.commandHint}
                </span>
              </div>
              <Input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && primaryCommand) {
                    event.preventDefault();
                    primaryCommand.run();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    setCommandOpen(false);
                  }
                }}
                className={cn(
                  "mt-3 h-11 rounded-xl",
                  isDark ? "border-white/10 bg-[#162233] text-slate-100 placeholder:text-slate-500" : "border-black/8 bg-[#fcfbf8]",
                )}
                placeholder={text.commandSearchPlaceholder}
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-3">
              {filteredCommands.length ? (
                filteredCommands.slice(0, 10).map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.run}
                      className={cn(
                        "mb-2 flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors last:mb-0",
                        isDark
                          ? "border-white/8 bg-[#111926] hover:bg-[#1a2839]"
                          : "border-black/6 bg-[#fcfbf8] hover:bg-[#f6efe2]",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg",
                          isDark ? "bg-white/10 text-slate-200" : "bg-white text-slate-600",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-semibold", isDark ? "text-slate-100" : "text-slate-800")}>{item.title}</p>
                        <p className={cn("mt-1 text-xs", isDark ? "text-slate-400" : "text-slate-500")}>{item.description}</p>
                        <p className={cn("mt-2 text-[11px] uppercase tracking-[0.14em]", isDark ? "text-slate-500" : "text-slate-400")}>{item.section}</p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div
                  className={cn(
                    "rounded-xl border px-3 py-8 text-center text-sm",
                    isDark ? "border-white/8 bg-[#111926] text-slate-400" : "border-black/6 bg-[#fcfbf8] text-slate-500",
                  )}
                >
                  {text.noCommandResults}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
