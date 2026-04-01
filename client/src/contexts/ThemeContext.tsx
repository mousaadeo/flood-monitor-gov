import React, { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "dark-tech" | "adeo-light";

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark-tech",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    return (localStorage.getItem("floodsat-theme") as AppTheme) || "dark-tech";
  });

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    localStorage.setItem("floodsat-theme", t);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    if (theme === "adeo-light") {
      root.classList.remove("dark");
      root.classList.add("adeo-light");
    } else {
      root.classList.remove("adeo-light");
      root.classList.add("dark");
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

// Legacy compatibility
export function useTheme() {
  const { theme, setTheme } = useContext(ThemeContext);
  return {
    theme: theme === "dark-tech" ? "dark" : "light",
    toggleTheme: () => setTheme(theme === "dark-tech" ? "adeo-light" : "dark-tech"),
    switchable: true,
  };
}
