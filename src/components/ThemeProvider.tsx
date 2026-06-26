"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Lazy initializer: runs once on mount, only on client
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("coffee-theme") as Theme | null) ?? "light";
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("coffee-theme", theme);
    }
  }, [theme, mounted]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  // Always render the same DOM structure to avoid unmount/remount cycles.
  // The visibility is toggled on a wrapper div rather than switching between
  // a <div> and <Provider>, which would cause React to destroy child state.
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div style={!mounted ? { visibility: "hidden" } : undefined}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/** Reusable iOS-style toggle switch */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="theme-toggle-wrapper">
      <label className="theme-toggle">
        <input
          type="checkbox"
          checked={theme === "light"}
          onChange={toggleTheme}
        />
        <span className="theme-toggle-track" />
        <span className="theme-toggle-icon moon">🌙</span>
        <span className="theme-toggle-icon sun">☀️</span>
      </label>
    </div>
  );
}
