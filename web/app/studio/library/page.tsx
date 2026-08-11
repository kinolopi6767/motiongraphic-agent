import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { VERBS } from "@/lib/storyboard";

const CATALOG: Record<string, { verb: string; label: string; blurb: string; fields: string[] }> = {
  "count-up": {
    verb: "count-up",
    label: "Stat bump",
    blurb: "One number counts up to its value — the single-claim stat shot.",
    fields: ["value (number)", "label", "suffix / prefix", "accent"],
  },
  "chart-race": {
    verb: "chart-race",
    label: "Chart race",
    blurb: "Ranked bars race into place — comparative proof for 2–6 quantities.",
    fields: ["title", "items[]: label, value, color", "accent"],
  },
  "kinetic-title": {
    verb: "kinetic-title",
    label: "Kinetic title",
    blurb: "Staggered headline lines with a single accent highlight — the title moment.",
    fields: ["lines[1–3]", "kicker", "accentOn (line index)", "accent"],
  },
  "pipeline-flow": {
    verb: "pipeline-flow",
    label: "Pipeline flow",
    blurb: "Stages flow left-to-right — the systems view of how parts connect.",
    fields: ["title", "nodes[2–6]: label, color", "accent"],
  },
};

const STARTERS: Record<string, string> = {
  "count-up": "Make a 12s stat tease with a count-up of our 18,400 signups.",
  "chart-race": "Make a 20s chart-race comparing 4 sales channels.",
  "kinetic-title": "Make a 15s kinetic-title opener for a launch announcement.",
  "pipeline-flow": "Make a 40s pipeline-flow explainer of how our render pipeline works.",
};

export default function LibraryPage() {
  return (
    <AppShell projectTitle="Library">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-accent-strong">
          Motion verbs &amp; brand
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Library</h1>
        <p className="mt-1 max-w-xl text-[14px] text-text-med">
          Every scene is built from one of four deterministic motion verbs. Start from a verb,
          or reuse the brand kit below.
        </p>

        <section aria-label="Motion verbs" className="mt-8">
          <h2 className="text-[15px] font-semibold text-text-hi">Motion verbs</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {VERBS.map((v) => {
              const c = CATALOG[v];
              return (
                <article key={v} className="rounded-card border border-border-subtle bg-surface-1 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold tracking-wide text-accent-strong">
                      {v}
                    </span>
                    <span className="text-[15px] font-semibold">{c.label}</span>
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-text-med">{c.blurb}</p>
                  <ul className="mt-3 flex flex-col gap-1 text-[13px] text-text-low">
                    {c.fields.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span aria-hidden className="text-accent-strong">
                          →
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Link
                      href={`/studio?brief=${encodeURIComponent(STARTERS[v])}`}
                      className="flex items-center"
                    >
                      Start a brief with {c.label}
                    </Link>
                  </Button>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-label="Brand kit" className="mt-10">
          <h2 className="text-[15px] font-semibold text-text-hi">Brand kit</h2>
          <div className="mt-4 rounded-card border border-border-subtle bg-surface-1 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold">Studio Black</p>
                <p className="mt-0.5 text-[13px] text-text-med">
                  The default kit — high-contrast, single-accent. Applied to every storyboard until
                  onboarding lets you build your own.
                </p>
                <div className="mt-3 flex items-center gap-2" aria-label="Palette">
                  {["#0B0E13", "#6366F1", "#818CF8", "#F2F4F8"].map((c) => (
                    <span
                      key={c}
                      title={c}
                      className="size-8 rounded-lg border border-border-subtle"
                      style={{ background: c }}
                    />
                  ))}
                  <span className="ml-2 text-[13px] text-text-low">· Inter · vibe: crisp</span>
                </div>
              </div>
              <BadgePill>contrast ✓ WCAG AA</BadgePill>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function BadgePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border-subtle bg-surface-2 px-3 py-1 text-[12px] font-medium text-text-med">
      {children}
    </span>
  );
}