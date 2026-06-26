import { useState, useEffect } from "react";

export function usePersistedState<T>(key: string, initialValue: T): [T, (val: T) => void] {
  const [state, setState] = useState<T>(() => {
    // Lazy initializer: runs once on mount, reads localStorage synchronously (client-side only)
    if (typeof window === "undefined") return initialValue;
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      try {
        return JSON.parse(saved) as T;
      } catch (e) {
        console.error(`[usePersistedState] Error parsing key "${key}":`, e);
      }
    }
    return initialValue;
  });


  // Sync state changes back to localStorage
  const setPersistedState = (value: T) => {
    setState(value);
    localStorage.setItem(key, JSON.stringify(value));
  };

  // Optional: Listen to changes from other tabs or documents
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setState(JSON.parse(e.newValue));
        } catch (err) {
          console.error(`[usePersistedState] Error parsing storage event for key "${key}":`, err);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key]);

  return [state, setPersistedState];
}
