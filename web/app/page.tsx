import Link from "next/link";
import { Button } from "@/components/button";
import { LandingForm } from "@/components/landing-form";

export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 500px at 70% 10%, rgba(99,102,241,0.14), transparent 60%), radial-gradient(700px 500px at 15% 90%, rgba(59,130,246,0.08), transparent 60%)",
        }}
      />
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            MG
          </span>
          <span className="text-[15px] font-semibold tracking-tight">MotionGraphic</span>
        </div>
        <nav aria-label="Main" className="flex items-center gap-2">
          <Link href="/studio" className="rounded-ctl px-3 py-2 text-[15px] text-text-med hover:text-text-hi">
            Studio
          </Link>
          <Button>
            <Link href="/studio" className="flex items-center">
              Start creating
            </Link>
          </Button>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-20 text-center">
        <p className="mb-4 rounded-full border border-border-subtle bg-surface-1 px-4 py-1.5 text-[13px] text-text-med">
          Review first. Render never blind.
        </p>
        <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Type a brief.{" "}
          <span className="text-accent-strong">Approve a storyboard.</span>
          <br />
          Ship a branded video.
        </h1>
        <p className="mt-6 max-w-xl text-balance text-lg text-text-med">
          The director agent plans every scene — timing, hooks, values — before a single credit
          is spent. Edit any word, number, or color afterward without re-rendering from scratch.
        </p>
<div className="mt-10 w-full max-w-xl">
            <LandingForm />
            <p className="mt-3 text-[13px] text-text-low">
            Free to plan. Credits only when you render. Captions, brand kit &amp; accessibility by default.
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-3">
        {[
          {
            k: "Storyboard gate",
            d: "Every scene is proposed — hook, values, duration — and approved before you spend anything.",
          },
          {
            k: "Editable forever",
            d: "Change any word or number; only the affected scenes re-render. No starting over.",
          },
          {
            k: "Accessible by default",
            d: "Captions, keyboard operability, WCAG 2.2 AA. Not a settings page — a default.",
          },
        ].map((f) => (
          <article key={f.k} className="rounded-card border border-border-subtle bg-surface-1 p-6">
            <h2 className="text-[17px] font-semibold">{f.k}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-text-med">{f.d}</p>
          </article>
        ))}
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              n: "01",
              k: "Type a brief",
              d: "A director agent plans scenes, timing and retention hooks — nothing renders yet, nothing costs.",
            },
            {
              n: "02",
              k: "Approve the storyboard",
              d: "Edit any word, number, duration or hook on the cards. Ask “why look” on any scene. Still free.",
            },
            {
              n: "03",
              k: "Ship the MP4",
              d: "Queue a render, watch the stage progress, then preview the video inline. Failed renders refund.",
            },
          ].map((s) => (
            <div key={s.n} className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-[14px] font-bold text-accent-strong">
                {s.n}
              </span>
              <div>
                <h2 className="text-[17px] font-semibold">{s.k}</h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-text-med">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-border-subtle">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8">
          <p className="text-[13px] text-text-low">
            MotionGraphic Agent · local-first · deterministic MP4s from approved storyboards
          </p>
          <p className="text-[13px] text-text-low">
            No account. No database. Your brief, your decisions.
          </p>
        </div>
      </footer>
    </main>
  );
}