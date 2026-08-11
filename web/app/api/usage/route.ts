import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

type UsageEntry = {
  at: string;
  kind: string;
  model: string;
  prompt: number;
  completion: number;
  total: number;
};

type StoryRecord = { id?: string; title?: string; usage?: UsageEntry[] };

/** Aggregate token usage across all storyboards (Settings → Usage). */
export async function GET() {
  const dir = join(process.cwd(), "data", "storyboards");
  const perBoard: { id: string; title: string; usage: UsageEntry[]; total: number }[] = [];
  const totals = { prompt: 0, completion: 0, total: 0 };
  const byModel: Record<string, { prompt: number; completion: number; total: number; calls: number }> = {};
  try {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      let record: StoryRecord;
      try {
        record = JSON.parse(await readFile(join(dir, f), "utf8"));
      } catch {
        continue;
      }
      const usage = record.usage ?? [];
      if (usage.length === 0) continue;
      const boardTotal = usage.reduce((a, u) => a + (u.total ?? 0), 0);
      for (const u of usage) {
        totals.prompt += u.prompt ?? 0;
        totals.completion += u.completion ?? 0;
        totals.total += u.total ?? 0;
        const m = byModel[u.model] ?? { prompt: 0, completion: 0, total: 0, calls: 0 };
        m.prompt += u.prompt ?? 0;
        m.completion += u.completion ?? 0;
        m.total += u.total ?? 0;
        m.calls += 1;
        byModel[u.model] = m;
      }
      perBoard.push({
        id: f.replace(/\.json$/, ""),
        title: record.title ?? record.id ?? f,
        usage,
        total: boardTotal,
      });
    }
  } catch {}
  perBoard.sort((a, b) => b.total - a.total);
  return NextResponse.json({ totals, byModel, perBoard });
}
