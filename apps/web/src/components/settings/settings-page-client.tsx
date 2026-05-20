"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CheckCheck,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  UserRound,
} from "lucide-react";
import { apiClient } from "../../lib/api/client";
import type { ApiError } from "../../lib/api/types";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { cn } from "../../lib/utils";

interface DocumentSettings {
  headerCompanyName: string;
  headerCompanySubtitle: string;
  headerAddressLine: string;
  headerPhone: string;
  headerPhoneSecondary: string;
  headerRc: string;
  headerTaxId: string;
  headerCapital: string;
  headerArabicCompanyName: string;
  headerArabicAddressLine: string;
  invoiceFooterConditions: string;
  bankIban: string;
  bankBic: string;
  bankAccountHolder: string;
}

interface OwnerAccountSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface WorkspaceSettings {
  companyName: string;
  branchName: string;
  city: string;
  addressLine1: string;
  postalCode: string;
  phone: string;
  email: string;
}

const emptySettings: DocumentSettings = {
  headerCompanyName: "",
  headerCompanySubtitle: "",
  headerAddressLine: "",
  headerPhone: "",
  headerPhoneSecondary: "",
  headerRc: "",
  headerTaxId: "",
  headerCapital: "",
  headerArabicCompanyName: "",
  headerArabicAddressLine: "",
  invoiceFooterConditions: "",
  bankIban: "",
  bankBic: "",
  bankAccountHolder: "",
};

const emptyAccount: OwnerAccountSettings = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

const emptyWorkspace: WorkspaceSettings = {
  companyName: "",
  branchName: "",
  city: "",
  addressLine1: "",
  postalCode: "",
  phone: "",
  email: "",
};

export function SettingsPageClient() {
  const [account, setAccount] = useState<OwnerAccountSettings>(emptyAccount);
  const [workspace, setWorkspace] = useState<WorkspaceSettings>(emptyWorkspace);
  const [settings, setSettings] = useState<DocumentSettings>(emptySettings);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingDocuments, setSavingDocuments] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [accountFeedback, setAccountFeedback] = useState("");
  const [workspaceFeedback, setWorkspaceFeedback] = useState("");
  const [documentFeedback, setDocumentFeedback] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const text = {
    eyebrow: "Administration",
    title: "Réglages",
    description:
      "Gérez le compte admin, l'entreprise, le mot de passe, la langue de l'interface, le pied de facture et les coordonnées bancaires.",
    accountTitle: "Compte admin",
    accountDescription: "Modifiez les informations du propriétaire connecté.",
    workspaceTitle: "Entreprise et agence",
    workspaceDescription: "Mettez à jour le nom de l'entreprise, l'agence locale et les coordonnées commerciales.",
    passwordTitle: "Mot de passe",
    passwordDescription: "Changez le mot de passe du compte propriétaire.",
    languageTitle: "Langue de l'interface",
    languageDescription: "Choisissez la langue principale utilisée dans l'admin local.",
    languageFrench: "Français",
    languageEnglish: "Anglais",
    invoiceHeaderTitle: "En-tête de facture",
    invoiceFooterTitle: "Pied de facture",
    behaviorTitle: "Comportement",
    loading: "Chargement des réglages...",
    loadError: "Impossible de charger les réglages des documents.",
    saveError: "Impossible d'enregistrer les réglages.",
    saved: "Réglages des documents enregistrés.",
    accountSaved: "Compte admin mis à jour.",
    workspaceSaved: "Réglages de l'entreprise enregistrés.",
    passwordSaved: "Mot de passe modifié.",
    accountSaveError: "Impossible d'enregistrer le compte admin.",
    workspaceSaveError: "Impossible d'enregistrer l'entreprise.",
    passwordSaveError: "Impossible de modifier le mot de passe.",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    passwordMismatch: "La confirmation du mot de passe ne correspond pas.",
    passwordLength: "Utilisez un mot de passe d'au moins 8 caractères.",
    firstName: "Prénom",
    lastName: "Nom",
    email: "Email",
    phone: "Téléphone",
    companyName: "Nom de l'entreprise",
    branchName: "Nom de l'agence / espace",
    city: "Ville",
    address: "Adresse",
    postalCode: "Code postal",
    headerCompanyName: "Nom affiché (FR/EN)",
    headerCompanySubtitle: "Sous-titre société (FR/EN)",
    headerAddressLine: "Adresse en en-tête (FR/EN)",
    headerPhone: "Téléphone en en-tête",
    headerPhoneSecondary: "Téléphone 2 en en-tête",
    headerRc: "Registre de commerce (RC)",
    headerTaxId: "Matricule fiscal",
    headerCapital: "Texte capital",
    headerArabicCompanyName: "Nom société en arabe",
    headerArabicAddressLine: "Adresse en arabe",
    conditions: "Texte des conditions",
    conditionsPlaceholder: "Laissez vide pour masquer le bloc Conditions dans les factures.",
    iban: "IBAN",
    ibanPlaceholder: "Laissez vide pour masquer les coordonnées bancaires.",
    bic: "BIC",
    holder: "Titulaire du compte",
    saveAccount: "Enregistrer le compte",
    saveWorkspace: "Enregistrer l'entreprise",
    savePassword: "Modifier le mot de passe",
    save: "Enregistrer les réglages",
    saving: "Enregistrement...",
    behavior1: "Le PDF de facture utilise maintenant ces valeurs enregistrées au lieu d'un contenu figé.",
    behaviorHeader: "Les champs d'en-tête sont utilisés pour l'aperçu, l'impression et le PDF facture.",
    behavior2: "Si le texte des conditions est vide, la section Conditions est masquée.",
    behavior3: "Si tous les champs bancaires sont vides, la section Coordonnées bancaires est masquée.",
    behavior4: "Les modifications s'appliquent à l'aperçu, à l'impression et au téléchargement PDF.",
  };

  useEffect(() => {
    void apiClient
      .get<OwnerAccountSettings>("/settings/account")
      .then((response) => {
        setAccount(response);
        return apiClient.get<WorkspaceSettings>("/settings/workspace");
      })
      .then((response) => {
        setWorkspace(response);
        return apiClient.get<DocumentSettings>("/settings/documents");
      })
      .then((response) => {
        setSettings(response);
      })
      .catch((cause) => {
        setError(getApiErrorMessage(cause, text.loadError));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [text.loadError]);

  async function handleSaveDocuments() {
    setSavingDocuments(true);
    setError("");
    setDocumentFeedback("");

    try {
      const response = await apiClient.patch<DocumentSettings>("/settings/documents", settings);
      setSettings(response);
      setDocumentFeedback(text.saved);
    } catch (cause) {
      setError(getApiErrorMessage(cause, text.saveError));
    } finally {
      setSavingDocuments(false);
    }
  }

  async function handleSaveAccount() {
    setSavingAccount(true);
    setError("");
    setAccountFeedback("");

    try {
      const response = await apiClient.patch<OwnerAccountSettings>("/settings/account", account);
      setAccount(response);
      setAccountFeedback(text.accountSaved);
    } catch (cause) {
      setError(getApiErrorMessage(cause, text.accountSaveError));
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleSaveWorkspace() {
    setSavingWorkspace(true);
    setError("");
    setWorkspaceFeedback("");

    try {
      const response = await apiClient.patch<WorkspaceSettings>("/settings/workspace", workspace);
      setWorkspace(response);
      setWorkspaceFeedback(text.workspaceSaved);
    } catch (cause) {
      setError(getApiErrorMessage(cause, text.workspaceSaveError));
    } finally {
      setSavingWorkspace(false);
    }
  }

  async function handleSavePassword() {
    setSavingPassword(true);
    setPasswordError("");
    setPasswordFeedback("");

    if (newPassword.length < 8) {
      setPasswordError(text.passwordLength);
      setSavingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(text.passwordMismatch);
      setSavingPassword(false);
      return;
    }

    try {
      await apiClient.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback(text.passwordSaved);
    } catch (cause) {
      setPasswordError(getApiErrorMessage(cause, text.passwordSaveError));
    } finally {
      setSavingPassword(false);
    }
  }

  const accountState = account.email ? "Connecté" : "À compléter";
  const workspaceState = workspace.companyName ? workspace.companyName : "Entreprise locale";
  const securityState = currentPassword || newPassword || confirmPassword ? "Modification en cours" : "Stable";
  const documentState =
    settings.bankIban || settings.bankBic || settings.bankAccountHolder ? "Coordonnées bancaires visibles" : "Facture allégée";
  const bankVisible = Boolean(settings.bankIban || settings.bankBic || settings.bankAccountHolder);

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#283443] bg-[linear-gradient(135deg,#17212d_0%,#243548_46%,#c45b2d_165%)] p-6 text-white shadow-[0_30px_90px_rgba(19,30,44,0.22)]">
        <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_42%)]" />
        <div className="absolute right-[-4rem] top-[-4rem] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(243,194,141,0.24),transparent_68%)]" />

        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_320px]">
          <div className="space-y-6">
            <div className="space-y-4">
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white/72">
                {text.eyebrow}
              </span>
              <div className="space-y-3">
                <h1 className="max-w-4xl text-[clamp(2.3rem,5vw,4.1rem)] font-semibold leading-[0.95] tracking-[-0.05em]">
                  Réglages plus lisibles, décisions plus rapides.
                </h1>
                <p className="max-w-3xl text-[15px] leading-7 text-white/78">
                  Regroupez en un seul écran le compte admin, la sécurité, l'identité d'entreprise et tout ce qui
                  remonte dans les factures. L'objectif est simple: savoir quoi modifier, où agir, et quel impact cela
                  aura sur l'application locale.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <HeroMetric label="Compte admin" value={account.email || "Non configuré"} />
              <HeroMetric label="Entreprise" value={workspace.companyName || "À compléter"} tone="accent" />
              <HeroMetric label="Sécurité" value={securityState} tone="success" />
              <HeroMetric label="Facturation" value={documentState} tone="accent" />
            </div>
          </div>

          <div className="grid gap-4 self-start">
            <div className="rounded-[1.6rem] border border-white/14 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/58">Pilotage</p>
              <p className="mt-3 text-sm leading-6 text-white/82">
                Les réglages structurent l'identité affichée, la sécurité d'accès et les données qui remontent dans
                les documents commerciaux.
              </p>
            </div>

            <div className="grid gap-2 rounded-[1.6rem] border border-white/12 bg-[#fff7ec] p-4 text-slate-900">
              <QuickStateRow label="Compte" value={accountState} />
              <QuickStateRow label="Espace" value={workspaceState} />
              <QuickStateRow label="Ville" value={workspace.city || "-"} />
              <QuickStateRow label="Banque" value={bankVisible ? "Visible" : "Masquée"} />
            </div>
          </div>
        </div>
      </section>

      {error ? <ErrorBanner message={error} /> : null}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-6">
          <SettingsSection
            icon={<UserRound className="h-4 w-4" />}
            title={text.accountTitle}
            description={text.accountDescription}
            accent="default"
          >
            {accountFeedback ? <SuccessBanner message={accountFeedback} /> : null}
            <div className="grid gap-2 rounded-[1.35rem] border border-[#e8dece] bg-[#fcfaf6] p-4 text-sm text-slate-600">
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email actif" value={account.email || "Non configuré"} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Téléphone" value={account.phone || "Non renseigné"} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={text.firstName}>
                <Input
                  value={account.firstName}
                  onChange={(event) => setAccount((current) => ({ ...current, firstName: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </Field>
              <Field label={text.lastName}>
                <Input
                  value={account.lastName}
                  onChange={(event) => setAccount((current) => ({ ...current, lastName: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </Field>
              <Field label={text.email}>
                <Input
                  type="email"
                  value={account.email}
                  onChange={(event) => setAccount((current) => ({ ...current, email: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </Field>
              <Field label={text.phone}>
                <Input
                  value={account.phone}
                  onChange={(event) => setAccount((current) => ({ ...current, phone: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]"
                onClick={() => void handleSaveAccount()}
                disabled={loading || savingAccount}
              >
                <Save className="h-4 w-4" />
                {savingAccount ? text.saving : text.saveAccount}
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<Shield className="h-4 w-4" />}
            title={text.passwordTitle}
            description={text.passwordDescription}
            accent="warning"
          >
            {passwordFeedback ? <SuccessBanner message={passwordFeedback} /> : null}
            {passwordError ? <ErrorBanner message={passwordError} /> : null}
            <div className="grid gap-2 rounded-[1.35rem] border border-[#e8dece] bg-[#fcfaf6] p-4 text-sm leading-6 text-slate-600">
              <p>1. Utilisez au moins 8 caractères.</p>
              <p>2. Évitez de réutiliser un mot de passe déjà exposé ailleurs.</p>
              <p>3. Confirmez exactement le nouveau mot de passe avant validation.</p>
            </div>
            <Field label={text.currentPassword}>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
              />
            </Field>
            <Field label={text.newPassword}>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
              />
            </Field>
            <Field label={text.confirmPassword}>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
              />
            </Field>
            <div className="flex justify-end">
              <Button
                type="button"
                className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]"
                onClick={() => void handleSavePassword()}
                disabled={loading || savingPassword}
              >
                <Save className="h-4 w-4" />
                {savingPassword ? text.saving : text.savePassword}
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection
            icon={<Building2 className="h-4 w-4" />}
            title={text.workspaceTitle}
            description={text.workspaceDescription}
            accent="accent"
          >
            {workspaceFeedback ? <SuccessBanner message={workspaceFeedback} /> : null}
            <div className="grid gap-2 rounded-[1.35rem] border border-[#e8dece] bg-[#fcfaf6] p-4 text-sm text-slate-600">
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="Entreprise" value={workspace.companyName || "À compléter"} />
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Ville" value={workspace.city || "-"} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email commercial" value={workspace.email || "Non renseigné"} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={text.companyName}>
                <Input
                  value={workspace.companyName}
                  onChange={(event) => setWorkspace((current) => ({ ...current, companyName: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </Field>
              <Field label={text.branchName}>
                <Input
                  value={workspace.branchName}
                  onChange={(event) => setWorkspace((current) => ({ ...current, branchName: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </Field>
              <Field label={text.city}>
                <Input
                  value={workspace.city}
                  onChange={(event) => setWorkspace((current) => ({ ...current, city: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </Field>
              <Field label={text.postalCode}>
                <Input
                  value={workspace.postalCode}
                  onChange={(event) => setWorkspace((current) => ({ ...current, postalCode: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </Field>
              <Field label={text.phone}>
                <Input
                  value={workspace.phone}
                  onChange={(event) => setWorkspace((current) => ({ ...current, phone: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </Field>
              <Field label={text.email}>
                <Input
                  type="email"
                  value={workspace.email}
                  onChange={(event) => setWorkspace((current) => ({ ...current, email: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </Field>
              <div className="grid gap-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">{text.address}</label>
                <Input
                  value={workspace.addressLine1}
                  onChange={(event) => setWorkspace((current) => ({ ...current, addressLine1: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-[#fcfbf8]"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]"
                onClick={() => void handleSaveWorkspace()}
                disabled={loading || savingWorkspace}
              >
                <Save className="h-4 w-4" />
                {savingWorkspace ? text.saving : text.saveWorkspace}
              </Button>
            </div>
          </SettingsSection>
        </div>

        <div className="grid gap-6">
          <SettingsSection
            icon={<FileText className="h-4 w-4" />}
            title="Facturation et documents"
            description="Configurez ce qui s'affiche dans l'en-tête, les conditions de facture et les coordonnées bancaires."
            accent="accent"
          >
            {loading ? <p className="text-sm text-muted-foreground">{text.loading}</p> : null}
            {documentFeedback ? <SuccessBanner message={documentFeedback} /> : null}

            <div className="grid gap-3 md:grid-cols-2">
              <MiniInfoCard label="Nom affiché" value={settings.headerCompanyName || "À compléter"} />
              <MiniInfoCard label="Banque" value={bankVisible ? "Visible sur facture" : "Masquée"} />
            </div>

            <div className="grid gap-5 rounded-[1.5rem] border border-[#e7ddce] bg-[#fcfaf6] p-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{text.invoiceHeaderTitle}</p>
                <p className="text-sm text-slate-500">Identité affichée en aperçu, impression et PDF.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={text.headerCompanyName}>
                  <Input
                    value={settings.headerCompanyName}
                    onChange={(event) => setSettings((current) => ({ ...current, headerCompanyName: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
                <Field label={text.headerCompanySubtitle}>
                  <Input
                    value={settings.headerCompanySubtitle}
                    onChange={(event) => setSettings((current) => ({ ...current, headerCompanySubtitle: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
                <Field label={text.headerAddressLine}>
                  <Input
                    value={settings.headerAddressLine}
                    onChange={(event) => setSettings((current) => ({ ...current, headerAddressLine: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
                <Field label={text.headerPhone}>
                  <Input
                    value={settings.headerPhone}
                    onChange={(event) => setSettings((current) => ({ ...current, headerPhone: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
                <Field label={text.headerPhoneSecondary}>
                  <Input
                    value={settings.headerPhoneSecondary}
                    onChange={(event) => setSettings((current) => ({ ...current, headerPhoneSecondary: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
                <Field label={text.headerRc}>
                  <Input
                    value={settings.headerRc}
                    onChange={(event) => setSettings((current) => ({ ...current, headerRc: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
                <Field label={text.headerTaxId}>
                  <Input
                    value={settings.headerTaxId}
                    onChange={(event) => setSettings((current) => ({ ...current, headerTaxId: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
                <Field label={text.headerCapital}>
                  <Input
                    value={settings.headerCapital}
                    onChange={(event) => setSettings((current) => ({ ...current, headerCapital: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
                <Field label={text.headerArabicCompanyName}>
                  <Input
                    dir="rtl"
                    value={settings.headerArabicCompanyName}
                    onChange={(event) => setSettings((current) => ({ ...current, headerArabicCompanyName: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
                <Field label={text.headerArabicAddressLine}>
                  <Input
                    dir="rtl"
                    value={settings.headerArabicAddressLine}
                    onChange={(event) => setSettings((current) => ({ ...current, headerArabicAddressLine: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
              </div>
            </div>

            <div className="grid gap-5 rounded-[1.5rem] border border-[#e7ddce] bg-[#fcfaf6] p-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{text.invoiceFooterTitle}</p>
                <p className="text-sm text-slate-500">Conditions de facture et coordonnées bancaires visibles selon ce qui est renseigné.</p>
              </div>
              <Field label={text.conditions}>
                <Textarea
                  value={settings.invoiceFooterConditions}
                  onChange={(event) => setSettings((current) => ({ ...current, invoiceFooterConditions: event.target.value }))}
                  placeholder={text.conditionsPlaceholder}
                  rows={6}
                  className="rounded-2xl border-[#ddd3c3] bg-white"
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={text.iban}>
                  <Input
                    value={settings.bankIban}
                    onChange={(event) => setSettings((current) => ({ ...current, bankIban: event.target.value }))}
                    placeholder={text.ibanPlaceholder}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
                <Field label={text.bic}>
                  <Input
                    value={settings.bankBic}
                    onChange={(event) => setSettings((current) => ({ ...current, bankBic: event.target.value }))}
                    className="rounded-2xl border-[#ddd3c3] bg-white"
                  />
                </Field>
              </div>
              <Field label={text.holder}>
                <Input
                  value={settings.bankAccountHolder}
                  onChange={(event) => setSettings((current) => ({ ...current, bankAccountHolder: event.target.value }))}
                  className="rounded-2xl border-[#ddd3c3] bg-white"
                />
              </Field>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="rounded-2xl bg-[#2f4156] hover:bg-[#253548]"
                  onClick={() => void handleSaveDocuments()}
                  disabled={loading || savingDocuments}
                >
                  <Save className="h-4 w-4" />
                  {savingDocuments ? text.saving : text.save}
                </Button>
              </div>
            </div>
          </SettingsSection>

          <Card className="border-[#ddd3c3] bg-[#fffdfa]">
            <CardHeader>
              <CardTitle className="text-[1.45rem]">Impact des réglages</CardTitle>
              <CardDescription>
                Les comportements utiles à garder visibles pour éviter les surprises dans les documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ImpactRow icon={<FileText className="h-4 w-4" />} text={text.behaviorHeader} />
              <ImpactRow icon={<CheckCheck className="h-4 w-4" />} text={text.behavior1} />
              <ImpactRow icon={<Landmark className="h-4 w-4" />} text={text.behavior3} />
              <ImpactRow icon={<Shield className="h-4 w-4" />} text={text.behavior4} />
              <ImpactRow icon={<FileText className="h-4 w-4" />} text={text.behavior2} />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-slate-700">{props.label}</label>
      {props.children}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      <CheckCheck className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

function SettingsSection({
  icon,
  title,
  description,
  children,
  accent = "default",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  accent?: "default" | "accent" | "warning";
}) {
  return (
    <Card className="border-[#ddd3c3] bg-[#fffdfa]">
      <CardHeader className="border-b border-[#eee4d5] bg-[linear-gradient(180deg,#fffdfa_0%,#faf5ed_100%)]">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              accent === "default" && "bg-[#eef3f8] text-[#2f4156]",
              accent === "accent" && "bg-[#f7ecdf] text-[#9b5a2d]",
              accent === "warning" && "bg-amber-100 text-amber-700",
            )}
          >
            {icon}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-[1.55rem] text-slate-900">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 pt-6">{children}</CardContent>
    </Card>
  );
}

function HeroMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "success";
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">{label}</p>
      <p
        className={cn(
          "mt-2 text-[1.5rem] font-semibold leading-tight tracking-[-0.04em] text-white",
          tone === "accent" && "text-[#f7cfa7]",
          tone === "success" && "text-[#bdf2cd]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function QuickStateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/85 px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[12rem] truncate font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="inline-flex items-center gap-2 text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <span className="max-w-[13rem] truncate font-medium text-slate-900">{value}</span>
    </div>
  );
}

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-[#e6dccd] bg-[#fcfaf6] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ImpactRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[1.2rem] border border-[#ebe1d3] bg-[#fcfaf6] px-4 py-3 text-sm leading-6 text-slate-600">
      <div className="mt-0.5 text-[#2f4156]">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiError | undefined;
  if (apiError?.error?.details?.length) {
    return apiError.error.details.map((detail) => detail.message).join(" ");
  }

  return apiError?.error?.message || fallback;
}
