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
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("coffee-theme") as Theme | null;
    if (saved) {
      setTheme(saved);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("coffee-theme", theme);
    }
  }, [theme, mounted]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  // Prevent flash of wrong theme
  if (!mounted) {
    return (
      <div style={{ visibility: "hidden" }}>
        {children}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
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
