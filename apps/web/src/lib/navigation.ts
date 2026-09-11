export interface NavigationItem {
  title: string;
  href: string;
  description: string;
  icon: IconKey;
  badge?: string;
  requiredPermission: string;
}

export interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export type Locale = "fr" | "en";

export type IconKey =
  | "home"
  | "users"
  | "user-plus"
  | "file-text"
  | "receipt"
  | "truck"
  | "hammer"
  | "wallet"
  | "coins"
  | "folder"
  | "shield"
  | "key-round"
  | "settings";

export function getNavigationSections(_locale: Locale, permissions?: readonly string[]): NavigationSection[] {
  const sections: NavigationSection[] = [
    {
      title: "Pilotage",
      items: [
        {
          title: "Centre de pilotage",
          href: "/dashboard",
          description: "Vue globale sur le chiffre, les urgences, les devis, les factures et les chantiers en cours.",
          icon: "home",
          requiredPermission: "dashboard.read",
        },
      ],
    },
    {
      title: "Clients",
      items: [
        {
          title: "Clients",
          href: "/crm/clients",
          description: "Fiches clients, contacts, historique, documents et encours de règlement.",
          icon: "users",
          requiredPermission: "clients.read",
        },
        {
          title: "Prospects",
          href: "/crm/leads",
          description: "Prospection, rappels, qualification commerciale et conversion en client.",
          icon: "user-plus",
          requiredPermission: "leads.read",
        },
      ],
    },
    {
      title: "Ventes et facturation",
      items: [
        {
          title: "Devis",
          href: "/sales/quotations",
          description: "Préparation des offres, validation commerciale, PDF et conversion en facture.",
          icon: "file-text",
          requiredPermission: "quotations.read",
        },
        {
          title: "Factures",
          href: "/sales/invoices",
          description: "Émission, échéances, suivi des paiements, relances et génération des bons associés.",
          icon: "receipt",
          requiredPermission: "invoices.read",
        },
        {
          title: "Bons de livraison",
          href: "/sales/delivery-notes",
          description: "Documents de sortie, transport, preuve de livraison et suivi terrain.",
          icon: "truck",
          requiredPermission: "delivery_notes.read",
        },
      ],
    },
    {
      title: "Chantiers et finance",
      items: [
        {
          title: "Chantiers",
          href: "/operations/projects",
          description: "Suivi chantier, planning, étapes, mesures, pièces jointes et avancement.",
          icon: "hammer",
          requiredPermission: "projects.read",
        },
        {
          title: "Paiements",
          href: "/finance/payments",
          description: "Encaissements clients, affectation aux factures et références de règlement.",
          icon: "wallet",
          requiredPermission: "payments.read",
        },
        {
          title: "Paiements ouvriers",
          href: "/finance/worker-payments",
          description: "Avances, fins de mois et historique des paiements d'équipe et sous-main.",
          icon: "coins",
          requiredPermission: "payments.read",
        },
        {
          title: "Dépenses",
          href: "/finance/expenses",
          description: "Coûts chantier, charges générales, validation et lecture de rentabilité.",
          icon: "coins",
          requiredPermission: "expenses.read",
        },
        {
          title: "Documents",
          href: "/documents",
          description: "Bibliothèque documentaire centralisée pour clients, projets, devis et factures.",
          icon: "folder",
          requiredPermission: "files.read",
        },
      ],
    },
    {
      title: "Administration",
      items: [
        {
          title: "Réglages",
          href: "/settings",
          description: "Société, compte admin, coordonnées bancaires, modèles documentaires et sécurité.",
          icon: "settings",
          requiredPermission: "settings.read",
        },
      ],
    },
  ];

  if (!permissions) return sections;
  const allowed = new Set(permissions);
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => allowed.has(item.requiredPermission)),
    }))
    .filter((section) => section.items.length > 0);
}

export const navigationSections = getNavigationSections("fr");
export const navigation = navigationSections.flatMap((section) => section.items);

export const workflowSteps = [
  "Qualification du prospect",
  "Visite de site et cadrage",
  "Devis et validation",
  "Fabrication et exécution chantier",
  "Bon de livraison et facturation",
  "Paiement et clôture",
] as const;
