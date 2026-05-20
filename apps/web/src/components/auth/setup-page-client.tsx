"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { companyBrand } from "../../lib/branding";
import { apiClient } from "../../lib/api/client";
import type { ApiError } from "../../lib/api/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type AuthUser = Awaited<ReturnType<typeof apiClient.me>>;

export function SetupPageClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [submittingSetup, setSubmittingSetup] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [passwordError, setPasswordError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("ChangeMe123!");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("SO.TE.CO");
  const [branchName, setBranchName] = useState("Espace propriétaire");
  const [city, setCity] = useState("Tunis");
  const [addressLine1, setAddressLine1] = useState("Cité Bouhsina");
  const [postalCode, setPostalCode] = useState("4081");
  const [phone, setPhone] = useState("+216 73 230 179");
  const [email, setEmail] = useState("contact@sotec.tn");
  const [ownerFirstName, setOwnerFirstName] = useState("Propriétaire");
  const [ownerLastName, setOwnerLastName] = useState("Compte");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!apiClient.hasSession()) {
        router.replace("/login");
        return;
      }

      try {
        const sessionUser = await apiClient.me();
        if (cancelled) {
          return;
        }

        if (!sessionUser.requiresPasswordChange && !sessionUser.workspaceSetupRequired) {
          router.replace("/dashboard");
          return;
        }

        setUser(sessionUser);
        setOwnerFirstName(sessionUser.firstName || "Propriétaire");
        setOwnerLastName(sessionUser.lastName || "Compte");
      } catch {
        apiClient.clearSession();
        if (!cancelled) {
          router.replace("/login");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function refreshUser() {
    const sessionUser = await apiClient.me();
    setUser(sessionUser);
    if (!sessionUser.requiresPasswordChange && !sessionUser.workspaceSetupRequired) {
      router.replace("/dashboard");
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("Utilisez un mot de passe d'au moins 8 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setSubmittingPassword(true);

    try {
      await apiClient.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refreshUser();
    } catch (error) {
      setPasswordError(getApiErrorMessage(error, "Impossible de modifier le mot de passe."));
    } finally {
      setSubmittingPassword(false);
    }
  }

  async function handleSetupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSetupError("");
    setSubmittingSetup(true);

    try {
      await apiClient.bootstrapWorkspace({
        companyName,
        branchName,
        city,
        addressLine1,
        postalCode,
        phone,
        email,
        ownerFirstName,
        ownerLastName,
      });
      await refreshUser();
    } catch (error) {
      setSetupError(getApiErrorMessage(error, "Impossible d'enregistrer la configuration de l'espace."));
    } finally {
      setSubmittingSetup(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6">
        <div className="rounded-[2rem] border border-black/6 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          Chargement de la configuration de l'espace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f1e8] px-6 py-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] bg-[#111926] px-8 py-8 text-white shadow-[0_28px_60px_rgba(17,25,38,0.18)]">
          <div className="flex items-center gap-4">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-2">
              <Image src={companyBrand.logoPath} alt={companyBrand.name} width={88} height={88} className="h-16 w-16 object-contain" priority />
            </div>
            <div>
              <p className="text-2xl font-semibold">{companyBrand.name}</p>
              <p className="max-w-xs text-sm text-slate-400">{companyBrand.subtitle}</p>
            </div>
          </div>

          <div className="mt-10 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Première configuration</p>
            <h1 className="text-5xl font-semibold tracking-tight">
              Terminez la configuration propriétaire avant d'utiliser l'espace.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-300">
              Cette installation utilise un compte propriétaire sécurisé, une base PostgreSQL locale et un stockage documentaire local. Modifiez le mot de passe propriétaire et terminez la configuration de l'entreprise, puis continuez dans l'ERP.
            </p>
          </div>

          <div className="mt-10 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            <p className="font-medium text-white">Propriétaire actuel</p>
            <p className="mt-2">{user?.fullName}</p>
            <p className="text-slate-400">{user?.email}</p>
          </div>
        </section>

        <section className="grid gap-6">
          {user?.requiresPasswordChange ? (
            <form onSubmit={handlePasswordSubmit} className="rounded-[2rem] border border-black/6 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sécurité</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Modifier le mot de passe propriétaire</h2>
                <p className="mt-2 text-sm text-slate-500">Le mot de passe par défaut doit être remplacé avant utilisation.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Mot de passe actuel</label>
                  <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Nouveau mot de passe</label>
                  <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Confirmer le mot de passe</label>
                  <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12 rounded-2xl" />
                </div>
              </div>

              {passwordError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {passwordError}
                </div>
              ) : null}

              <div className="mt-6 flex justify-end">
                <Button type="submit" className="h-11 rounded-2xl bg-[#2f4156] hover:bg-[#253548]" disabled={submittingPassword}>
                  {submittingPassword ? "Mise à jour..." : "Enregistrer le mot de passe"}
                </Button>
              </div>
            </form>
          ) : null}

          {user?.workspaceSetupRequired ? (
            <form onSubmit={handleSetupSubmit} className="rounded-[2rem] border border-black/6 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Espace</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Terminer la configuration de l'espace propriétaire</h2>
                <p className="mt-2 text-sm text-slate-500">Ces valeurs remplacent les paramètres initiaux et deviennent la référence locale de l'entreprise.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Nom de l'entreprise</label>
                  <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Nom de l'agence / espace</label>
                  <Input value={branchName} onChange={(event) => setBranchName(event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Ville</label>
                  <Input value={city} onChange={(event) => setCity(event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Adresse</label>
                  <Input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Code postal</label>
                  <Input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Téléphone</label>
                  <Input value={phone} onChange={(event) => setPhone(event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Email entreprise</label>
                  <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Prénom du propriétaire</label>
                  <Input value={ownerFirstName} onChange={(event) => setOwnerFirstName(event.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Nom du propriétaire</label>
                  <Input value={ownerLastName} onChange={(event) => setOwnerLastName(event.target.value)} className="h-12 rounded-2xl" />
                </div>
              </div>

              {setupError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {setupError}
                </div>
              ) : null}

              <div className="mt-6 flex justify-end">
                <Button type="submit" className="h-11 rounded-2xl bg-[#2f4156] hover:bg-[#253548]" disabled={submittingSetup}>
                  {submittingSetup ? "Enregistrement..." : "Enregistrer l'espace"}
                </Button>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "error" in error) {
    const apiError = error as ApiError;
    return apiError.error?.details?.[0]?.message ?? apiError.error?.message ?? fallback;
  }
  return fallback;
}
