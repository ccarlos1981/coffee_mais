import { useState, useEffect } from "react";

export function usePersistedState<T>(key: string, initialValue: T): [T, (val: T) => void] {
  // Inicialização segura para garantir paridade 100% entre SSR e Hydration
  const [state, setState] = useState<T>(initialValue);

  // Sincroniza do localStorage estritamente APÓS a montagem do cliente (pós-hidratação)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        try {
          setState(JSON.parse(saved) as T);
        } catch (e) {
          console.error(`[usePersistedState] Error parsing key "${key}":`, e);
        }
      }
    }
  }, [key]);

  // Atualiza o estado e persiste no localStorage
  const setPersistedState = (value: T) => {
    setState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  // Ouve alterações de outras abas ou documentos
  useEffect(() => {
    if (typeof window === "undefined") return;
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
