import Link from "next/link";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { BrandKitsSection } from "@/components/brand-kits-section";
import { StoryboardScene, VERBS, sceneBadge, sceneSummary } from "@/lib/storyboard";

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
  timeline: {
    verb: "timeline",
    label: "Timeline journey",
    blurb: "A line draws across milestones — how the story unfolded over time.",
    fields: ["title", "events[2–6]: label, value, color", "accent"],
  },
  "radial-gauge": {
    verb: "radial-gauge",
    label: "Radial gauge",
    blurb: "One metric as a living dial that fills — completion, share, score.",
    fields: ["value (number)", "label", "unit", "accent"],
  },
};

const STARTERS: Record<string, string> = {
  "count-up": "Make a 12s stat tease with a count-up of our 18,400 signups.",
  "chart-race": "Make a 20s chart-race comparing 4 sales channels.",
  "kinetic-title": "Make a 15s kinetic-title opener for a launch announcement.",
  "pipeline-flow": "Make a 40s pipeline-flow explainer of how our render pipeline works.",
  timeline: "Make a 30s timeline of our company's journey over three milestones.",
  "radial-gauge": "Make a 10s radial gauge showing our 92% customer satisfaction.",
};

export const dynamic = "force-dynamic";

type ApprovedScene = {
  scene: StoryboardScene;
  storyboardId: string;
  storyboardTitle: string;
  index: number;
};

async function approvedScenes(): Promise<ApprovedScene[]> {
  const dir = join(process.cwd(), "data", "storyboards");
  const out: ApprovedScene[] = [];
  try {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      let record: { storyboard: { title: string; scenes: StoryboardScene[] } };
      try {
        record = JSON.parse(await readFile(join(dir, f), "utf8"));
      } catch {
        continue;
      }
      record.storyboard.scenes.forEach((scene, index) => {
        if (scene.approved) {
          out.push({
            scene,
            storyboardId: f.replace(/\.json$/, ""),
            storyboardTitle: record.storyboard.title,
            index,
          });
        }
      });
    }
  } catch {}
  return out;
}

export default async function LibraryPage() {
  const approved = await approvedScenes();
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

        <section aria-label="Approved scenes" className="mt-10">
          <h2 className="text-[15px] font-semibold text-text-hi">Approved scenes</h2>
          <p className="mt-1 text-[13px] text-text-med">
            Scenes you marked “Approved” on a storyboard — reusable building blocks.
          </p>
          {approved.length === 0 ? (
            <div className="mt-4 rounded-card border border-dashed border-border-subtle p-8 text-center text-[14px] text-text-med">
              Nothing approved yet. Open a storyboard, hit Edit, and tick “Approved — reusable in
              the scene library”.
            </div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {approved.map(({ scene, storyboardId, storyboardTitle, index }) => (
                <li
                  key={`${storyboardId}-${index}`}
                  className="rounded-card border border-border-subtle bg-surface-1 p-5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold tracking-wide text-accent-strong">
                      {sceneBadge(scene)}
                    </span>
                    <span className="text-[13px] tabular-nums text-text-low">{scene.duration}s</span>
                  </div>
                  <p className="mt-3 text-[15px] leading-snug">{sceneSummary(scene)}</p>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Link
                      href={`/studio/${storyboardId}#scene-${index}`}
                      className="flex items-center"
                    >
                      View in {storyboardTitle}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Brand kits" className="mt-10">
          <BrandKitsSection />
        </section>
      </main>
    </AppShell>
  );
}