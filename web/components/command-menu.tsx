"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Cmd = { id: string; label: string; hint?: string; href?: string; action?: () => void };

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Cmd[] = [
    { id: "new", label: "New video", hint: "brief → storyboard", href: "/studio" },
    { id: "projects", label: "Projects", hint: "local storyboards", href: "/studio/projects" },
    { id: "jobs", label: "Jobs", hint: "render queue", href: "/studio/jobs" },
    { id: "library", label: "Library", hint: "verbs & brand kit", href: "/studio/library" },
    { id: "settings", label: "Settings", hint: "credits, theme, data", href: "/studio/settings" },
    {
      id: "toggle-theme",
      label: "Toggle theme",
      hint: "dark / light / system",
      action: () => {
        const root = document.documentElement;
        const cur = root.getAttribute("data-theme");
        const next = cur === "light" ? "system" : cur === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        if (next === "system") root.removeAttribute("data-theme");
        try {
          localStorage.setItem("mg-theme", next);
        } catch {}
      },
    },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) setQuery("");
          return !o;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()));

  const run = (c: Cmd) => {
    setOpen(false);
    if (c.action) c.action();
    else if (c.href) router.push(c.href);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-card border border-border-subtle bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (filtered[index]) run(filtered[index]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Jump to…"
          aria-label="Search commands"
          className="w-full border-b border-border-subtle bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-text-low"
        />
        <ul className="max-h-72 overflow-y-auto p-1.5" role="listbox">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-[14px] text-text-low">No matches.</li>
          )}
          {filtered.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === index}
              id={`cmd-${c.id}`}
            >
              <button
                type="button"
                onClick={() => run(c)}
                onMouseEnter={() => setIndex(i)}
                className={`flex w-full items-center justify-between gap-3 rounded-ctl px-3 py-2.5 text-left text-[14px] ${
                  i === index ? "bg-accent-soft text-text-hi" : "text-text-med"
                }`}
              >
                <span className="font-medium">{c.label}</span>
                {c.hint && <span className="text-[12px] text-text-low">{c.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-border-subtle px-3 py-2 text-[12px] text-text-low">
          ↑↓ to move · Enter to run · Esc to close
        </p>
      </div>
    </div>
  );
}