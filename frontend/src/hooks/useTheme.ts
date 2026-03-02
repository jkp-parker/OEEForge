import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "oeeforge_theme";

function getSnapshot(): "dark" | "light" {
  return (localStorage.getItem(STORAGE_KEY) as "dark" | "light") || "light";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Apply on load
applyTheme(getSnapshot());

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    // Trigger re-render via storage event workaround
    window.dispatchEvent(new Event("storage"));
  }, [theme]);

  return { theme, toggle };
}
