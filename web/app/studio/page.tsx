"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";

type Kit = { id: string; name: string; colors: string[]; vibe: string };

const STYLES = [  { id: "studio-black", label: "Studio Black", swatches: ["#0B0E13", "#6366F1", "#818CF8", "#F2F4F8"], desc: "Dark canvas, crisp, indigo accent — the default." },
  { id: "neon", label: "Neon Nights", swatches: ["#05010F", "#22D3EE", "#E879F9"], desc: "Electric cyan + magenta on near-black." },
  { id: "paper", label: "Minimal Paper", swatches: ["#F6F7F9", "#1F2430", "#4F46E5"], desc: "Light paper canvas, dark ink, one accent." },
  { id: "luxury", label: "Luxury Gold", swatches: ["#0D0B08", "#C9A227", "#F5E6C4"], desc: "Black + gold — premium, quiet drama." },
  { id: "energetic", label: "Energetic", swatches: ["#16040F", "#FB923C", "#7C3AED"], desc: "Vivid orange → violet, high voltage." },
  { id: "nature", label: "Deep Forest", swatches: ["#07110C", "#34D399", "#A7F3D0"], desc: "Deep green with fresh emerald light." },
] as const;

function StylePicker({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2 sm:col-span-2">
      <legend className="text-[14px] font-medium text-text-med">Visual style</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {STYLES.map((s) => (
          <label
            key={s.id}
            className={`cursor-pointer rounded-ctl border p-2.5 transition-colors ${
              selected === s.id
                ? "border-accent bg-accent-soft"
                : "border-border-subtle bg-surface-1 hover:border-border-subtle"
            }`}
          >
            <input
              type="radio"
              name="style"
              value={s.id}
              checked={selected === s.id}
              onChange={() => onChange(s.id)}
              className="sr-only"
            />
            <span className="flex items-center gap-2">
              <span className="flex -space-x-1">
                {s.swatches.map((c) => (
                  <span
                    key={c}
                    className="size-4 rounded-full border border-surface-1"
                    style={{ background: c }}
                  />
                ))}
              </span>
              <span className="text-[13px] font-medium">{s.label}</span>
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-text-low">{s.desc}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const QUALITY_OPTS = [
  { id: "normal", label: "Normal", desc: "fast render" },
  { id: "medium", label: "Medium", desc: "cleaner encode" },
  { id: "max", label: "Max", desc: "highest bitrate + extra animation" },
] as const;

function QualityPicker({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2 sm:col-span-2">
      <legend className="text-[14px] font-medium text-text-med">Render quality</legend>
      <div className="flex flex-wrap gap-2">
        {QUALITY_OPTS.map((q) => (
          <label
            key={q.id}
            className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-ctl border px-3 text-[13px] transition-colors ${
              selected === q.id
                ? "border-accent bg-accent-soft font-semibold text-accent-strong"
                : "border-border-subtle bg-surface-1 text-text-med hover:text-text-hi"
            }`}
          >
            <input
              type="radio"
              name="quality"
              value={q.id}
              checked={selected === q.id}
              onChange={() => onChange(q.id)}
              className="sr-only"
            />
            {q.label}
            <span className={`text-[11px] font-normal ${selected === q.id ? "text-accent-strong" : "text-text-low"}`}>
              {q.desc}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Quick model picker for project creation — auto-saves (shared with Settings). */
function ModelQuickPick() {
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setProvider(d.llm?.provider ?? "zen");
        setModel(d.llm?.model ?? "deepseek-v4-flash-free");
      })
      .catch(() => {});
  }, []);
  if (provider === null || model === null) return null;
  const switchTo = async (m: string) => {
    setModel(m);
    try {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "zen", model: m }),
      });
    } catch {}
  };
  return (
    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
      <span className="text-[14px] font-medium text-text-med">AI model</span>
      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-strong">
        {model}
      </span>
      {["deepseek-v4-flash-free", "mimo-v2.5-free"].map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={model === m}
          onClick={() => switchTo(m)}
          className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
            model === m
              ? "border-accent bg-accent-soft font-semibold text-accent-strong"
              : "border-border-subtle text-text-med hover:border-accent"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function KitPicker({
  selected,
  onChange,
  kits,
}: {
  selected: string | null;
  onChange: (id: string | null) => void;
  kits: Kit[];
}) {
  if (kits.length === 0) return null;
  return (
    <label className="flex flex-col gap-2 sm:col-span-2">
      <span className="text-[14px] font-medium text-text-med">Brand kit (optional)</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={selected === null}
          onClick={() => onChange(null)}
          className={`rounded-ctl border px-3 py-2 text-[13px] transition-colors ${
            selected === null
              ? "border-accent bg-accent-soft font-semibold text-accent-strong"
              : "border-border-subtle bg-surface-1 text-text-med hover:text-text-hi"
          }`}
        >
          No kit
        </button>
        {kits.map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={selected === k.id}
            onClick={() => onChange(selected === k.id ? null : k.id)}
            className={`flex items-center gap-2 rounded-ctl border px-3 py-2 text-[13px] transition-colors ${
              selected === k.id
                ? "border-accent bg-accent-soft font-semibold text-accent-strong"
                : "border-border-subtle bg-surface-1 text-text-med hover:text-text-hi"
            }`}
          >
            <span className="flex -space-x-1.5">
              {k.colors.slice(0, 3).map((c) => (
                <span
                  key={c}
                  className="size-4 rounded-full border border-surface-1"
                  style={{ background: c }}
                />
              ))}
            </span>
            {k.name}
          </button>
        ))}
      </div>
    </label>
  );
}

function BriefForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [brief, setBrief] = useState(search.get("brief") ?? "");
  const [duration, setDuration] = useState("");
  const [tone, setTone] = useState("");
  const [ratio, setRatio] = useState("16:9");
  const [brandKitId, setBrandKitId] = useState<string | null>(search.get("kit"));
  const [style, setStyle] = useState("studio-black");
  const [quality, setQuality] = useState("max");
  const [kits, setKits] = useState<Kit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/brand-kits")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setKits(d.kits ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const submit = async () => {
    if (brief.trim().length < 10 || busy) return;
    setBusy(true);
    setError(null);
    // The director can take a while; never leave the button spinning silently.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 100_000);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brief: brief.trim(),
          duration: duration ? Number(duration) : undefined,
          tone: tone || undefined,
          ratio,
          style,
          quality,
          brandKitId: brandKitId ?? undefined,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `request failed (${res.status})`);
      }
      const d = await res.json();
      router.push(`/studio/${d.id}`);
    } catch (e) {
      if (e instanceof TypeError) {
        setError("Can't reach the server — make sure `npm run dev` is running, then reload this page.");
      } else {
        setError(
          e instanceof DOMException && e.name === "AbortError"
            ? "The director took too long — is the server still running? (start it with npm run dev)"
            : e instanceof Error
              ? e.message
              : "Something went wrong",
        );
      }
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-accent-strong">
        Step 1 · Brief
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">What should the video say?</h1>
      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-medium text-text-med">Brief or script</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={6}
            placeholder='e.g. "A 12s explainer of how HyperFrames renders HTML motion graphics to MP4 — headless Chrome, GSAP timeline, FFmpeg. Curious, crisp."'
            aria-label="Brief or script"
            className="resize-y rounded-card border border-border-subtle bg-surface-1 p-4 text-[15px] leading-relaxed outline-none placeholder:text-text-low focus:border-accent"
          />
          <span className="text-right text-[13px] tabular-nums text-text-low">
            {brief.length} chars {brief.length > 0 && brief.length < 10 ? "· min 10" : ""}
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-medium text-text-med">
              Target duration (optional)
            </span>
            <input
              type="number"
              min={8}
              max={90}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="auto — from the script"
              aria-label="Target duration in seconds (optional, auto from script)"
              className="min-h-[44px] rounded-ctl border border-border-subtle bg-surface-1 px-3 text-[15px] outline-none placeholder:text-text-low focus:border-accent"
            />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[14px] font-medium text-text-med">Output ratio</legend>
            <div className="flex gap-2">
              {["16:9", "1:1", "9:16"].map((r) => (
                <label
                  key={r}
                  className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-ctl border text-[14px] transition-colors ${
                    ratio === r
                      ? "border-accent bg-accent-soft font-semibold text-accent-strong"
                      : "border-border-subtle bg-surface-1 text-text-med hover:text-text-hi"
                  }`}
                >
                  <input
                    type="radio"
                    name="ratio"
                    value={r}
                    checked={ratio === r}
                    onChange={() => setRatio(r)}
                    className="sr-only"
                  />
                  {r}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-[14px] font-medium text-text-med">Tone (optional)</span>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="curious · crisp · energetic"
              aria-label="Tone (optional)"
              className="min-h-[44px] rounded-ctl border border-border-subtle bg-surface-1 px-3 text-[15px] outline-none placeholder:text-text-low focus:border-accent"
            />
          </label>
          <KitPicker selected={brandKitId} onChange={setBrandKitId} kits={kits} />
          <StylePicker selected={style} onChange={setStyle} />
          <QualityPicker selected={quality} onChange={setQuality} />
          <ModelQuickPick />
        </div>

        {error && (
          <p role="alert" className="rounded-card border border-danger/40 bg-danger/10 px-4 py-3 text-[14px] text-danger">
            {error}
          </p>
        )}

        <Button disabled={busy || brief.trim().length < 10} className="mt-2 sm:self-start sm:px-10">
          {busy ? "Director is planning…" : "Plan the storyboard — free"}
        </Button>
        <p className="text-[13px] text-text-low">
          You approve every scene before any render. Caps at 90s for now.
        </p>
      </form>
    </div>
  );
}

export default function NewVideo() {
  return (
    <AppShell projectTitle="New video">
      <Suspense fallback={null}>
        <BriefForm />
      </Suspense>
    </AppShell>
  );
}