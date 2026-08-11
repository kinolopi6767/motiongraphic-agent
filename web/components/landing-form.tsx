"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

export function LandingForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const go = () => {
    const q = encodeURIComponent(query.trim());
    if (q) router.push(`/studio?brief=${q}`);
  };
  return (
    <form
      className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-1 p-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <input
        aria-label="Describe the video you want"
        placeholder='Try "a 30s explainer of how our pipeline turns HTML into MP4"'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="min-h-[44px] flex-1 rounded-ctl bg-transparent px-3 text-[15px] outline-none placeholder:text-text-low"
      />
      <Button type="submit" className="sm:px-8">
        Generate
      </Button>
    </form>
  );
}