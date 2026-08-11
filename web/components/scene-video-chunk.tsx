"use client";

/**
 * A scene is a chunk of the rendered video — the latest render's segment for
 * this scene, playable right on the storyboard card.
 */
export function SceneVideoChunk({ jobId, index }: { jobId: string; index: number }) {
  return (
    <video
      src={`/api/jobs/${jobId}/segments/${index}`}
      controls
      preload="metadata"
      muted
      className="mt-3 w-full rounded-ctl border border-border-subtle bg-surface-2"
      aria-label={`Scene ${index + 1} video chunk from the latest render`}
    />
  );
}
