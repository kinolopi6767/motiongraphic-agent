"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { HookOption } from "@/lib/storyboard";

export function HookPicker({
  storyboardId,
  index,
  applied,
}: {
  storyboardId: string;
  index: number;
  applied: string | undefined;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "options" | "error">("idle");
  const [options, setOptions] = useState<HookOption[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patching, setPatching] = useState(false);

  const generate = async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/storyboards/${storyboardId}/hooks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "hook engineer failed");
      }
      const d = await res.json();
      setOptions(d.options ?? []);
      setState("options");
    } catch (e) {
      setError(e instanceof Error ? e.message : "hook engineer failed");
      setState("error");
    }
  };

  const apply = async (o: HookOption) => {
    setPatching(true);
    setError(null);
    try {
      const res = await fetch(`/api/storyboards/${storyboardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          index,
          scene: {
            hook: o.hook,
            microhook: o.microhook || "",
            tone: undefined,
          },
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "apply failed");
      }
      setChosen(o.hook);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "apply failed");
    } finally {
      setPatching(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={generate} disabled={state === "loading"}>
          {state === "loading" ? "Hooking…" : "3 hooks · A/B/C"}
        </Button>
        {applied && (
          <span className="text-[12px] text-text-low">
            applied: <span className="text-text-med">&ldquo;{applied}&rdquo;</span>
          </span>
        )}
      </div>
      {state === "options" && (
        <div className="flex w-full min-w-[280px] flex-col gap-1.5 rounded-ctl border border-border-subtle bg-surface-2 p-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-low">
            Pick a cold-open (director&apos;s alternatives)
          </p>
          {options.map((o, i) => (
            <button
              key={i}
              type="button"
              onClick={() => apply(o)}
              disabled={patching}
              className={`flex items-start gap-2 rounded-ctl border px-2.5 py-2 text-left text-[13px] transition-colors ${
                chosen === o.hook
                  ? "border-accent bg-accent-soft text-text-hi"
                  : "border-border-subtle bg-surface-1 text-text-med hover:text-text-hi"
              }`}
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{o.hook}</span>
                {o.microhook && (
                  <span className="block text-[12px] text-text-low">→ {o.microhook}</span>
                )}
              </span>
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={generate}>
            Regenerate
          </Button>
        </div>
      )}
      {state === "error" && error && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-danger">{error}</span>
          <Button variant="ghost" size="sm" onClick={generate}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}