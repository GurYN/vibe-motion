"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "theme";

// Subscribe to storage changes
function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// Get theme from localStorage (client only), default to "dark"
function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(THEME_KEY) as Theme) || "dark";
}

// Server snapshot always returns "dark"
function getServerSnapshot(): Theme {
  return "dark";
}

// Subscribe to system preference changes
function subscribeToMediaQuery(callback: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

// Get current system preference
function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Server snapshot for system preference (matches default theme)
function getSystemPreferenceServer(): "light" | "dark" {
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Use useSyncExternalStore for hydration-safe localStorage access
  const theme = useSyncExternalStore(
    subscribeToStorage,
    getStoredTheme,
    getServerSnapshot
  );

  // Use useSyncExternalStore for system preference
  const systemPreference = useSyncExternalStore(
    subscribeToMediaQuery,
    getSystemPreference,
    getSystemPreferenceServer
  );

  // Compute resolved theme (no state needed)
  const resolvedTheme: "light" | "dark" =
    theme === "system" ? systemPreference : theme;

  // Apply theme class to document
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  // setTheme writes to localStorage and triggers re-render via useSyncExternalStore
  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(THEME_KEY, newTheme);
    // Dispatch storage event to trigger useSyncExternalStore update
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY }));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
