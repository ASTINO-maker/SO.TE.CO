"use client";

import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import { usePersistedState } from "./use-persisted-state";

export type Locale = "fr" | "en";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale | ((current: Locale) => Locale)) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [, setStoredLocale] = usePersistedState<Locale>("sotec.locale.v2", "fr");

  useEffect(() => {
    setStoredLocale("fr");
  }, [setStoredLocale]);

  return (
    <LocaleContext.Provider
      value={{
        locale: "fr",
        setLocale: () => setStoredLocale("fr"),
        toggleLocale: () => setStoredLocale("fr"),
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const value = useContext(LocaleContext);

  if (!value) {
    throw new Error("useLocale must be used inside LocaleProvider");
  }

  return value;
}
