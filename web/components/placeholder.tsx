import { AppShell } from "@/components/app-shell";

export function Placeholder({ title, next }: { title: string; next: string }) {
  return (
    <AppShell projectTitle={title}>
      <main className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-accent-strong">
          Not built yet
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-md text-[15px] text-text-med">{next}</p>
      </main>
    </AppShell>
  );
}