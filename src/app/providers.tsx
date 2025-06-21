"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useLayoutEffect, createContext, useContext } from "react";

const ThemeContext = createContext<{
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
}>({
  darkMode: false,
  setDarkMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext)!;
}

// Create context for sensitive data
const SensitiveDataContext = createContext<{
  showSensitiveData: boolean;
  toggleSensitiveData: () => void;
}>({
  showSensitiveData: true,
  toggleSensitiveData: () => {},
});

// Hook to use sensitive data context
export const useSensitiveData = () => {
  const context = useContext(SensitiveDataContext);
  if (!context) {
    throw new Error("useSensitiveData must be used within a SensitiveDataProvider");
  }
  return context;
};

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSensitiveData, setShowSensitiveData] = useState(true);

  useLayoutEffect(() => {
    setMounted(true);
    
    // Load dark mode setting
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode !== null) {
      const isDarkMode = savedDarkMode === "true";
      setDarkMode(isDarkMode);
      // Apply the CSS class immediately
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    
    // Load sensitive data setting (default to true - show sensitive data)
    const savedShowSensitiveData = localStorage.getItem("showSensitiveData");
    if (savedShowSensitiveData !== null) {
      setShowSensitiveData(savedShowSensitiveData === "true");
    } else {
      // Default to true (show sensitive data) if no setting exists
      setShowSensitiveData(true);
      localStorage.setItem("showSensitiveData", "true");
    }
  }, []);

  const handleSetDarkMode = (newDarkMode: boolean) => {
    setDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleSensitiveData = () => {
    const newValue = !showSensitiveData;
    setShowSensitiveData(newValue);
    localStorage.setItem("showSensitiveData", newValue.toString());
  };

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode: handleSetDarkMode }}>
      <SensitiveDataContext.Provider value={{ showSensitiveData, toggleSensitiveData }}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </SensitiveDataContext.Provider>
    </ThemeContext.Provider>
  );
}
