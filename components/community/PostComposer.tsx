"use client";

/**
 * The composer — the Kanvas Student Home one: a "What's on your mind?" pill
 * with a camera button that opens into the post form (title, words, photos
 * and videos, and for trainers "Pin to the top of the feed"). The first post
 * asks for the Community Guidelines agreement.
 */
import { useState } from "react";
import { Avatar } from "./Avatar";
import { GuidelinesCheckbox } from "./PostCard";
import { acceptGuidelines, createPost } from "@/lib/community/data";
import type { Viewer } from "@/lib/community/types";

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8h2.5l1.3-2h8.4l1.3 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
      />
      <circle cx="12" cy="13" r="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <rect x="3" y="6" width="13" height="12" rx="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 10.5 4.5-2.7v8.4l-4.5-2.7" />
    </svg>
  );
}

export function PostComposer({
  viewer,
  onPosted,
  onGuidelinesAccepted,
}: {
  viewer: Viewer;
  onPosted: () => void;
  onGuidelinesAccepted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [pinned, setPinned] = useState(false);
  const [agree, setAgree] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function collapse() {
    setExpanded(false);
    setTitle("");
    setBody("");
    setPhotos([]);
    setVideos([]);
    setPinned(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !body.trim() && photos.length === 0 && videos.length === 0) {
      setError("Write something or add a photo/video first.");
      return;
    }
    if (!viewer.guidelinesAccepted && !agree) {
      setError("Please agree to the Community Guidelines first.");
      return;
    }
    setError(null);
    setPosting(true);
    try {
      if (!viewer.guidelinesAccepted) {
        await acceptGuidelines(viewer.id);
        onGuidelinesAccepted();
      }
      await createPost(viewer, { title: title.trim(), body: body.trim(), files: [...photos, ...videos], pinned });
      collapse();
      onPosted();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not save your post.");
    } finally {
      setPosting(false);
    }
  }

  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition-colors hover:border-white/30 active:bg-white/5"
        >
          <Avatar name={viewer.name} avatarUrl={viewer.avatarUrl} size="lg" />
          <span className="min-w-0 flex-1 truncate text-sm text-paper-dim">
            What&apos;s on your mind, {viewer.name}?
          </span>
        </button>
        <button
          type="button"
          aria-label="Add a photo or video"
          onClick={() => setExpanded(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-paper-dim transition-colors hover:border-white/30 hover:text-paper active:bg-white/5"
        >
          <CameraIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <Avatar name={viewer.name} avatarUrl={viewer.avatarUrl} size="lg" />
        <div>
          <p className="text-sm font-medium text-paper">{viewer.name}</p>
          <p className="text-xs text-paper-dim">Posting to Community</p>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        type="text"
        placeholder="Add a title (optional)"
        className="mt-4 min-w-0 bg-transparent text-base font-medium text-paper outline-none placeholder:text-paper-dim"
      />

      <textarea
        rows={3}
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share something…"
        className="mt-1 w-full min-w-0 resize-none bg-transparent text-sm text-paper outline-none placeholder:text-paper-dim"
      />

      {(photos.length > 0 || videos.length > 0) && (
        <p className="mt-1 text-xs text-paper-dim">
          {photos.length > 0 && `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
          {photos.length > 0 && videos.length > 0 && " · "}
          {videos.length > 0 && `${videos.length} video${videos.length === 1 ? "" : "s"}`} attached
        </p>
      )}

      {viewer.isTrainer && (
        <label className="mt-3 flex items-center gap-2 text-xs text-paper">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-white" />
          Pin to the top of the feed
        </label>
      )}

      {!viewer.guidelinesAccepted && (
        <div className="mt-3">
          <GuidelinesCheckbox checked={agree} onChange={setAgree} />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div className="flex gap-2">
          <label
            htmlFor="post-photo"
            aria-label="Add photos"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 text-paper-dim transition-colors hover:border-white/30 hover:text-paper active:bg-white/5"
          >
            <CameraIcon className="h-4 w-4" />
          </label>
          <input
            id="post-photo"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          />
          <label
            htmlFor="post-video"
            aria-label="Add videos"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 text-paper-dim transition-colors hover:border-white/30 hover:text-paper active:bg-white/5"
          >
            <VideoIcon className="h-4 w-4" />
          </label>
          <input
            id="post-video"
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => setVideos(Array.from(e.target.files ?? []))}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={collapse}
            disabled={posting}
            className="rounded-full px-4 py-2 text-sm font-medium text-paper-dim transition-colors hover:text-paper active:text-paper"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={posting}
            className="shrink-0 rounded-full bg-accent px-6 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-60"
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </form>
  );
}
