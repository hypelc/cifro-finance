"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "cifro:theme";
const ThemeContext = createContext(null);

function systemTheme() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(preference) {
  return preference === "system" ? systemTheme() : preference;
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const nextPreference = saved === "light" || saved === "system" || saved === "dark" ? saved : "system";
    setPreference(nextPreference);
  }, []);

  const theme = resolveTheme(preference);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (preference !== "system") return undefined;
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!media) return undefined;
    const update = () => {
      const nextTheme = media.matches ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
    };
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [preference]);

  const value = useMemo(() => ({
    preference,
    theme,
    setTheme(nextPreference) {
      if (!["light", "system", "dark"].includes(nextPreference)) return;
      window.localStorage.setItem(STORAGE_KEY, nextPreference);
      setPreference(nextPreference);
    },
  }), [preference, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme precisa estar dentro de ThemeProvider.");
  return context;
}
