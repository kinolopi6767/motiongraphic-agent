"use client";

import { useEffect, useState } from "react";

const KEY = "mg-theme";

function apply(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(KEY) as "light" | "dark" | "system" | null) ?? "system";
  });

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const next = () => {
    const map: Record<string, "light" | "dark" | "system"> = { dark: "light", light: "system", system: "dark" };
    const t = map[theme];
    setTheme(t);
    localStorage.setItem(KEY, t);
    apply(t);
  };

  const label = theme === "dark" ? "Switch to light theme" : theme === "light" ? "Switch to system theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={next}
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-ctl border border-border-subtle bg-surface-1 text-text-med transition-colors hover:bg-surface-2 hover:text-text-hi"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
        </svg>
      ) : theme === "light" ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}