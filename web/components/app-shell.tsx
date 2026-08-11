import Link from "next/link";
import { Button } from "@/components/button";
import { CreditsPill } from "@/components/credits-pill";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandMenu } from "@/components/command-menu";

const NAV = [
  { href: "/studio", label: "Create" },
  { href: "/studio/projects", label: "Projects" },
  { href: "/studio/library", label: "Library" },
  { href: "/studio/jobs", label: "Jobs" },
];

export function AppShell({
  children,
  projectTitle,
}: {
  children: React.ReactNode;
  projectTitle?: string;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-border-subtle bg-surface-1 px-3 py-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            MG
          </span>
          <span className="text-[15px] font-semibold tracking-tight">MotionGraphic</span>
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex min-h-[44px] items-center rounded-ctl px-3 py-2 text-[15px] text-text-med transition-colors hover:bg-surface-2 hover:text-text-hi"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <CreditsPill />
          <Button variant="outline" className="w-full">
            <Link href="/studio/settings" className="flex w-full items-center justify-center">
              Settings
            </Link>
          </Button>
          <p className="px-1 text-[12px] text-text-low">Press ⌘K for quick actions</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border-subtle bg-canvas/80 px-6 backdrop-blur">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{projectTitle ?? "Studio"}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-border-subtle px-3 py-1 text-[13px] text-text-med sm:block">
              ⌘K
            </span>
            <ThemeToggle />
            <Button>
              <Link href="/studio" className="flex items-center">
                + New video
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
      <CommandMenu />
    </div>
  );
}