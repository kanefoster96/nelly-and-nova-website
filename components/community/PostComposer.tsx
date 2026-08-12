"use client";

import { useState } from "react";
import { CameraIcon, VideoIcon, CloseIcon } from "@/components/ui/Icons";
import { Avatar } from "./Avatar";
import { addPost } from "@/lib/community/store";
import { fileToMedia } from "@/lib/community/data";
import type { MediaItem, Post } from "@/lib/community/types";

/** The composer — a collapsed pill that expands into a full post form. */
export function PostComposer({ user }: { user: { name: string; avatarUrl?: string } }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const firstName = user.name.split(" ")[0] || "there";

  function collapse() {
    setExpanded(false);
    setTitle("");
    setBody("");
    setMedia([]);
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const items = await Promise.all(Array.from(files).map(fileToMedia));
    setMedia((m) => [...m, ...items]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !title.trim() && media.length === 0) return;
    const post: Post = {
      id: `post-${crypto.randomUUID()}`,
      authorName: user.name,
      authorAvatarUrl: user.avatarUrl,
      mine: true,
      title: title.trim() || undefined,
      body: body.trim(),
      media,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      likedByMe: false,
      comments: [],
    };
    addPost(post);
    collapse();
  }

  const photos = media.filter((m) => m.type === "image").length;
  const videos = media.filter((m) => m.type === "video").length;

  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition-colors hover:border-white/30"
        >
          <Avatar name={user.name} avatarUrl={user.avatarUrl} />
          <span className="min-w-0 flex-1 truncate text-sm text-paper-dim">
            What&apos;s on your mind, {firstName}?
          </span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Add a photo or video"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-paper-dim transition-colors hover:border-white/30 hover:text-paper"
        >
          <CameraIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5"
    >
      <div className="flex items-center gap-3">
        <Avatar name={user.name} avatarUrl={user.avatarUrl} />
        <div>
          <p className="text-sm font-medium text-paper">{user.name}</p>
          <p className="text-xs text-paper-dim">Posting to the community</p>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a title (optional)"
        className="mt-4 w-full bg-transparent text-base font-medium text-paper outline-none placeholder:text-paper-dim"
      />

      <textarea
        rows={3}
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share something…"
        className="mt-1 w-full resize-none bg-transparent text-sm text-paper outline-none placeholder:text-paper-dim"
      />

      {media.length > 0 && (
        <div className="mt-2 flex items-center gap-3">
          <p className="text-xs text-paper-dim">
            {photos > 0 && `${photos} photo${photos === 1 ? "" : "s"}`}
            {photos > 0 && videos > 0 && " · "}
            {videos > 0 && `${videos} video${videos === 1 ? "" : "s"}`} attached
          </p>
          <button
            type="button"
            onClick={() => setMedia([])}
            className="inline-flex items-center gap-1 text-xs text-paper-dim hover:text-paper"
          >
            <CloseIcon className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div className="flex gap-2">
          <label
            htmlFor="community-photo"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 text-paper-dim transition-colors hover:border-white/30 hover:text-paper"
            aria-label="Add photos"
          >
            <CameraIcon className="h-4 w-4" />
          </label>
          <input
            id="community-photo"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />

          <label
            htmlFor="community-video"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 text-paper-dim transition-colors hover:border-white/30 hover:text-paper"
            aria-label="Add videos"
          >
            <VideoIcon className="h-4 w-4" />
          </label>
          <input
            id="community-video"
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={collapse}
            className="rounded-full px-4 py-2 text-sm font-medium text-paper-dim transition-colors hover:text-paper"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!body.trim() && !title.trim() && media.length === 0}
            className="rounded-full bg-accent px-6 py-2 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>
    </form>
  );
}
