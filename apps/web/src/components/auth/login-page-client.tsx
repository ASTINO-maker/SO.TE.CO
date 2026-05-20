"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { companyBrand } from "../../lib/branding";
import { apiClient } from "../../lib/api/client";
import type { ApiError } from "../../lib/api/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function LoginPageClient({ nextHref }: { nextHref: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("admin@sotec.local");
  const [password, setPassword] = useState("ChangeMe123!");

  const safeNextHref = useMemo(() => {
    if (!nextHref || !nextHref.startsWith("/")) {
      return "/dashboard";
    }
    return nextHref;
  }, [nextHref]);

  const text = {
    checking: "Vérification de la session...",
    workspace: "Espace propriétaire",
    heroTitle: "Centralisez devis, chantiers, livraison, factures et encaissements.",
    heroDescription:
      "Connectez-vous pour gérer les clients, les projets de fabrication, les documents commerciaux, les paiements et tout le flux SO.TE.CO du premier contact à la facture finale.",
    protectedTitle: "Accès protégé",
    protectedDescription:
      "Cet espace nécessite maintenant une session propriétaire authentifiée. La connexion automatique de démonstration a été supprimée.",
    signIn: "Connexion",
    welcome: "Bon retour",
    loginDescription: "Utilisez le compte propriétaire pour accéder à l'espace opérationnel.",
    localAccount: "Compte propriétaire local",
    accountHelp:
      "Après la première connexion réussie, l'application redirige vers la configuration de l'espace et impose un changement de mot de passe.",
    email: "E-mail",
    password: "Mot de passe",
    submit: "Se connecter",
    submitting: "Connexion...",
  };

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      if (!apiClient.hasSession()) {
        if (!cancelled) {
          setChecking(false);
        }
        return;
      }

      try {
        const user = await apiClient.me();
        if (!cancelled) {
          router.replace(resolvePostLoginPath(user, safeNextHref));
        }
      } catch {
        apiClient.clearSession();
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [router, safeNextHref]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const user = await apiClient.login(email.trim(), password);
      router.replace(resolvePostLoginPath(user, safeNextHref));
    } catch (issue) {
      setError(
        getApiErrorMessage(
          issue,
          "Impossible de se connecter avec ces identifiants.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6">
        <div className="rounded-[2rem] border border-black/6 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          {text.checking}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f1e8] px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-[2.25rem] border border-black/6 bg-white shadow-[0_32px_80px_rgba(15,23,36,0.08)] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden bg-[#111926] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-2">
                <Image src={companyBrand.logoPath} alt={companyBrand.name} width={92} height={92} className="h-16 w-16 object-contain" priority />
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">{companyBrand.name}</p>
                <p className="max-w-xs text-sm text-slate-400">{companyBrand.subtitle}</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{text.workspace}</p>
              <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-white">
                {text.heroTitle}
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-300">
                {text.heroDescription}
              </p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            <p className="font-medium text-white">{text.protectedTitle}</p>
            <p className="mt-2 leading-6">
              {text.protectedDescription}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="mb-4 inline-flex items-center gap-3 rounded-2xl border border-black/6 bg-[#f8f5ee] px-4 py-3">
                <Image src={companyBrand.logoPath} alt={companyBrand.name} width={56} height={56} className="h-12 w-12 object-contain" priority />
                <div>
                  <p className="text-lg font-semibold tracking-tight text-slate-900">{companyBrand.name}</p>
                  <p className="text-xs text-slate-500">{companyBrand.subtitle}</p>
                </div>
              </div>
            </div>

            <div className="mb-8 space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">{text.signIn}</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{text.welcome}</h2>
              <p className="text-sm leading-6 text-slate-500">{text.loginDescription}</p>
            </div>

            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">{text.localAccount}</p>
              <p className="mt-1">
                {text.email}: <span className="font-semibold">admin@sotec.local</span>
              </p>
              <p>
                {text.password}: <span className="font-semibold">ChangeMe123!</span>
              </p>
              <p className="mt-2 text-amber-800">
                {text.accountHelp}
              </p>
            </div>

            <form className="grid gap-5" onSubmit={handleSubmit}>
              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  {text.email}
                  </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 rounded-2xl"
                />
              </div>

              <div className="grid gap-2">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  {text.password}
                  </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-2xl"
                />
              </div>

              <Button type="submit" className="h-12 rounded-2xl bg-[#2f4156] text-base hover:bg-[#253548]" disabled={submitting}>
                {submitting ? text.submitting : text.submit}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolvePostLoginPath(
  user: Awaited<ReturnType<typeof apiClient.me>>,
  fallback: string,
) {
  if (user.requiresPasswordChange || user.workspaceSetupRequired) {
    return "/setup";
  }

  return fallback;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "error" in error) {
    const apiError = error as ApiError;
    return apiError.error?.details?.[0]?.message ?? apiError.error?.message ?? fallback;
  }
  return fallback;
}
