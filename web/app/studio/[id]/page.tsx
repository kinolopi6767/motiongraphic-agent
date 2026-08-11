import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RenderButton } from "@/components/render-button";
import { SceneEditor } from "@/components/scene-editor";
import {
  Storyboard,
  sceneBadge,
  sceneSummary,
} from "@/lib/storyboard";

const STORE = join(process.cwd(), "data", "storyboards");

export const dynamic = "force-dynamic";

export default async function StoryboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let record: { storyboard: Storyboard; brief: string; createdAt: string };
  try {
    record = JSON.parse(await readFile(join(STORE, `${id}.json`), "utf8"));
  } catch {
    notFound();
  }
  const sb = record.storyboard;

  return (
    <AppShell projectTitle={sb.title}>
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* scenes rail */}
        <section
          aria-label="Scenes"
          className="hidden w-80 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border-subtle p-4 lg:flex"
        >
          {sb.scenes.map((s, i) => (
            <article
              key={i}
              className="rounded-card border border-border-subtle bg-surface-1 p-4"
              tabIndex={0}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold tracking-wide text-accent-strong">
                  {sceneBadge(s)}
                </span>
                <span className="text-[13px] tabular-nums text-text-low">{s.duration}s</span>
              </div>
              <p className="mt-3 text-[15px] leading-snug">{sceneSummary(s)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.hook && (
                  <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[12px] text-text-med">
                    hook · {s.hook}
                  </span>
                )}
                {s.tone && (
                  <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[12px] text-text-med">
                    {s.tone}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>

        {/* stage */}
        <main className="min-w-0 flex-1 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-accent-strong">
                Step 2 · Review the storyboard
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{sb.title}</h1>
              <p className="mt-1 text-[14px] text-text-med">
                {sb.scenes.length} scenes · {sb.total}s · {sb.formatArchetype}
              </p>
            </div>
            <RenderButton storyboardId={id} />
          </div>

          <div className="mt-8 flex flex-col gap-4">
            {sb.scenes.map((s, i) => (
              <article
                key={i}
                className="grid gap-4 rounded-card border border-border-subtle bg-surface-1 p-5 lg:grid-cols-[auto_1fr_auto]"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-surface-3 text-[15px] font-semibold tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold tracking-wide text-accent-strong">
                      {sceneBadge(s)}
                    </span>
                    <span className="text-[13px] tabular-nums text-text-low">{s.duration}s</span>
                    <span className="text-[13px] text-text-med">{s.verb}</span>
                  </div>
                  <p className="mt-2 text-[16px] leading-snug">{sceneSummary(s)}</p>
                  <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-ctl bg-surface-2 p-3 text-[13px] leading-relaxed text-text-med">
                    {JSON.stringify(s.values, null, 1)}
                  </pre>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.hook && (
                      <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[12px] text-text-med">
                        hook · {s.hook}
                      </span>
                    )}
                    {s.microhook && (
                      <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[12px] text-text-med">
                        microhook · {s.microhook}
                      </span>
                    )}
                    {s.tone && (
                      <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[12px] text-text-med">
                        tone · {s.tone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start lg:flex-col lg:items-start lg:self-center">
                  <SceneEditor storyboardId={id} index={i} verb={s.verb} initial={s.values} />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-card border border-border-subtle bg-surface-1 p-5">
            <h2 className="text-[15px] font-semibold">Pacing meter</h2>
            <div
              className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-3"
              role="img"
              aria-label={`Pacing meter: ${sb.scenes.length} scenes across ${sb.total} seconds`}
            >
              {sb.scenes.map((s, i) => (
                <span
                  key={i}
                  className="h-full"
                  style={{
                    width: `${(s.duration / sb.total) * 100}%`,
                    background: `hsl(${(i * 137 + 230) % 360} 70% 60%)`,
                  }}
                />
              ))}
            </div>
            <p className="mt-3 text-[13px] text-text-low">
              Value bomb lands around 60–70% — hook in scene 1 pulls, last scene stamps.
            </p>
          </div>
        </main>
      </div>
    </AppShell>
  );
}