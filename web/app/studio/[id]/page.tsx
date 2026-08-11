import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CloneButton } from "@/components/clone-button";
import { ReRenderSceneButton } from "@/components/re-render-scene-button";
import { RenderButton } from "@/components/render-button";
import { RewriteSceneButton } from "@/components/rewrite-scene-button";
import { SceneVideoChunk } from "@/components/scene-video-chunk";
import { SceneEditor } from "@/components/scene-editor";
import { WhyLook } from "@/components/why-look";
import { ValuesChips } from "@/components/values-chips";
import { HookPicker } from "@/components/hook-picker";
import { costFor } from "@/lib/ledger.mjs";
import {
  Storyboard,
  runGuard,
  sceneAnnotation,
  sceneBadge,
  sceneSummary,
  valueBombIndex,
} from "@/lib/storyboard";

const STORE = join(process.cwd(), "data", "storyboards");
const JOBS_STORE = join(process.cwd(), "data", "jobs");

export const dynamic = "force-dynamic";

/** Latest done render for the storyboard (segment cache + scene-chunk previews). */
async function latestRender(storyboardId: string): Promise<{ jobId: string } | null> {
  try {
    const { readdir, readFile } = await import("node:fs/promises");
    const files = (await readdir(JOBS_STORE)).filter((f) => f.endsWith(".json") && !f.includes(".storyboard."));
    let best: { jobId: string; finishedAt: string } | null = null;
    for (const f of files) {
      try {
        const j = JSON.parse(await readFile(join(JOBS_STORE, f), "utf8"));
        if (
          j.storyboardId === storyboardId &&
          j.status === "done" &&
          Array.isArray(j.segments) &&
          j.segments.length > 0 &&
          (!best || (j.finishedAt || "") > best.finishedAt)
        ) {
          best = { jobId: j.id, finishedAt: j.finishedAt ?? "" };
        }
      } catch {}
    }
    return best ? { jobId: best.jobId } : null;
  } catch {}
  return null;
}

export default async function StoryboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let record: {
    storyboard: Storyboard;
    brief: string;
    ratio?: string;
    style?: string;
    quality?: string;
    brandKitId?: string;
    brandKitName?: string;
    palette?: string[];
    voiceTier?: string;
    usage?: { at: string; kind: string; model: string; prompt: number; completion: number; total: number }[];
    createdAt: string;
  };
  try {
    record = JSON.parse(await readFile(join(STORE, `${id}.json`), "utf8"));
  } catch {
    notFound();
  }
  const sb = record.storyboard;
  const bombIdx = valueBombIndex(sb.scenes, sb.total);
  const hookScenes = new Set<number>([0]);
  if (bombIdx > 0) hookScenes.add(bombIdx);
  const prevRender = await latestRender(id);
  const hasRender = prevRender !== null;
  const usageTotal = (record.usage ?? []).reduce((a, u) => a + (u.total ?? 0), 0);

  return (
    <AppShell projectTitle={sb.title}>
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* scenes rail */}
        <section
          aria-label="Scenes"
          className="hidden w-80 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border-subtle p-4 lg:flex"
        >
          {sb.scenes.map((s, i) => (
            <a
              key={i}
              href={`#scene-${i}`}
              className="scene-card rounded-card border border-border-subtle bg-surface-1 p-4 transition-colors hover:bg-surface-2"
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
                    hook
                  </span>
                )}
                {hookScenes.has(i) && <span className="text-[12px] text-text-low">A/B/C</span>}
                {s.tone && (
                  <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[12px] text-text-med">
                    {s.tone}
                  </span>
                )}
              </div>
            </a>
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
                {record.ratio && <> · {record.ratio}</>}
                {record.brandKitName && <> · {record.brandKitName}</>}
                {record.voiceTier && <> · voice tier: {record.voiceTier}</>} · free to edit
              </p>
              {record.palette && (
                <div className="mt-2 flex items-center gap-1.5" aria-label="Brand palette">
                  {record.palette.map((c) => (
                    <span
                      key={c}
                      title={c}
                      className="size-4 rounded-full border border-border-subtle"
                      style={{ background: c }}
                    />
                  ))}
                  <span className="ml-1 text-[12px] text-text-low">brand kit</span>
                </div>
              )}
              {usageTotal > 0 && (
                <p className="mt-1 text-[12px] tabular-nums text-text-low">
                  {(record.usage ?? []).length} LLM call{(record.usage ?? []).length === 1 ? "" : "s"} ·{" "}
                  {usageTotal.toLocaleString()} tokens
                </p>
              )}
            </div>
            <div className="flex items-start gap-2">
              <CloneButton storyboardId={id} />
              <RenderButton storyboardId={id} costEstimate={costFor(sb.total)} initialQuality={record.quality} />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4">
            {sb.scenes.map((s, i) => {
              const a = sceneAnnotation(s, i, sb.scenes.length, sb.total);
              return (
                <article
                  key={i}
                  id={`scene-${i}`}
                  className="scene-card scroll-mt-24 grid gap-4 rounded-card border border-border-subtle bg-surface-1 p-5 lg:grid-cols-[auto_1fr_auto]"
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
                    <div className="mt-3 rounded-ctl bg-surface-2 p-3">
                      <ValuesChips storyboardId={id} index={i} verb={s.verb} values={s.values} />
                    </div>
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
                    {prevRender && <SceneVideoChunk jobId={prevRender.jobId} index={i * 2} />}
                  </div>
                  <div className="flex flex-col items-start gap-3 self-start lg:items-start lg:self-center">
                    <SceneEditor
                      storyboardId={id}
                      index={i}
                      verb={s.verb}
                      initial={s.values}
                      duration={s.duration}
                      hook={s.hook}
                      microhook={s.microhook}
                      tone={s.tone}
                      approved={s.approved}
                    />
                    {hookScenes.has(i) && <HookPicker storyboardId={id} index={i} applied={s.hook} />}
                    <ReRenderSceneButton
                      storyboardId={id}
                      index={i}
                      cost={costFor(s.duration)}
                      hasPreviousRender={hasRender}
                    />
                    <RewriteSceneButton storyboardId={id} index={i} />
                    <WhyLook lines={[a.role, a.verb, a.pacing]} />
                  </div>
                </article>
              );
            })}
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
              {bombIdx >= 0 && (
                <>
                  {" "}
                  Scene <span className="font-semibold text-text-hi">{bombIdx + 1}</span> is your
                  value-bomb window — try its A/B/C hooks.
                </>
              )}
            </p>
          </div>

          <div className="mt-6 rounded-card border border-border-subtle bg-surface-1 p-5">
            <h2 className="text-[15px] font-semibold">Delivery guard</h2>
            <p className="mt-1 text-[13px] text-text-low">
              Pre-render contract checks from the plan — motion checks run against frames after
              render.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {runGuard(sb).map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 rounded-ctl border border-border-subtle bg-surface-2 px-3 py-2"
                >
                  <span
                    aria-hidden
                    className={
                      c.status === "pass"
                        ? "text-ok"
                        : c.status === "warn"
                          ? "text-warn"
                          : "text-danger"
                    }
                  >
                    {c.status === "pass" ? "✓" : c.status === "warn" ? "▲" : "✕"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{c.label}</span>
                    <span className="block text-[12px] text-text-med">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </AppShell>
  );
}