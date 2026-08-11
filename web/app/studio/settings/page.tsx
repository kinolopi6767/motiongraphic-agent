"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { ModelSettings } from "@/components/model-settings";
import { UsageSection } from "@/components/usage-section";
import { VoiceSettings } from "@/components/voice-settings";

export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const resetData = async () => {
    if (
      !window.confirm(
        "Clear ALL creation history — storyboards, jobs, brand kits and rendered MP4s? Settings stay. This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    setResetMsg(null);
    try {
      const res = await fetch("/api/data?confirm=1", { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setResetMsg("All creation history cleared. Settings kept.");
    } catch {
      setResetMsg("Reset failed — check server logs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell projectTitle="Settings">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-accent-strong">
          Preferences
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>

        <section aria-label="AI model" className="mt-8">
          <h2 className="text-[15px] font-semibold">AI model</h2>
          <div className="mt-3 rounded-card border border-border-subtle bg-surface-1 p-5">
            <ModelSettings />
          </div>
        </section>

        <section aria-label="Usage" className="mt-8">
          <h2 className="text-[15px] font-semibold">Token usage</h2>
          <div className="mt-3 rounded-card border border-border-subtle bg-surface-1 p-5">
            <UsageSection />
          </div>
        </section>

        <section aria-label="Voice" className="mt-8">
          <h2 className="text-[15px] font-semibold">Voice narration — Deepgram</h2>
          <div className="mt-3 rounded-card border border-border-subtle bg-surface-1 p-5">
            <VoiceSettings />
          </div>
        </section>

        <section aria-label="Accessibility" className="mt-8">
          <h2 className="text-[15px] font-semibold">Accessibility</h2>
          <div className="mt-3 rounded-card border border-border-subtle bg-surface-1 p-5">
            <ul className="flex flex-col gap-2 text-[14px] text-text-med">
              <li>→ WCAG 2.2 AA baseline at every screen, not a settings page.</li>
              <li>→ Focus rings never removed; every control keyboard-operable (⌘K included).</li>
              <li>→ <span className="font-medium text-text-hi">prefers-reduced-motion</span> disables UI animation automatically (OS-level).</li>
              <li>→ Captions, transcripts and accessible players ship with rendered videos.</li>
            </ul>
          </div>
        </section>

        <section aria-label="Theme" className="mt-8">
          <h2 className="text-[15px] font-semibold">Theme</h2>
          <div className="mt-3 rounded-card border border-border-subtle bg-surface-1 p-5">
            <p className="text-[14px] text-text-med">
              Use the sun/moon control in the top bar, or <span className="font-medium text-text-hi">⌘K → Toggle theme</span>.
              Cycles dark → light → system.
            </p>
          </div>
        </section>

        <section aria-label="Local data" className="mt-8">
          <h2 className="text-[15px] font-semibold">Local data</h2>
          <div className="mt-3 rounded-card border border-border-subtle bg-surface-1 p-5">
            <p className="text-[14px] text-text-med">
              Everything lives in <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">web/data/</code> plus rendered
              MP4s in <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">output/web-jobs/</code>. No account, no database.
            </p>
            <div className="mt-4">
              <Button variant="danger" onClick={resetData} disabled={busy}>
                {busy ? "Clearing…" : "Clear all history"}
              </Button>
              {resetMsg && <p className="mt-2 text-[13px] text-text-med">{resetMsg}</p>}
            </div>
          </div>
        </section>

        <section aria-label="About" className="mt-8">
          <h2 className="text-[15px] font-semibold">About</h2>
          <div className="mt-3 rounded-card border border-border-subtle bg-surface-1 p-5">
            <p className="text-[14px] text-text-med">
              MotionGraphic Agent — brief → storyboard gate → deterministic MP4. Renders via
              HyperFrames + GSAP + FFmpeg, planned by the director agent. Supposed to be
              premium; decisions are yours.
            </p>
          </div>
        </section>
      </main>
    </AppShell>
  );
}