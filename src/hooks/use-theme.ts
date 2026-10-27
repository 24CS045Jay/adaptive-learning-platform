import { useEffect } from "react";

export type Theme = "light";

export function useTheme() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.removeItem("adeptive-theme");
      } catch {}
    }
  }, []);

  const toggle = () => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.remove("dark");
    }
  };

  return { theme: "light" as Theme, toggle, isDark: false };
}

