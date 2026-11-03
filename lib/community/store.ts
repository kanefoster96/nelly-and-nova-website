"use client";

/**
 * Community feed loader for the website.
 * --------------------------------------
 * Loads the signed-in viewer and the feed from Supabase (lib/community/data.ts)
 * once auth has resolved, and again whenever the account changes. Components
 * update the list in place (new post, delete, block) via `setPosts`, or call
 * `reload()` to fetch it fresh.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStatus, useSession } from "@/lib/auth/session";
import { getFeed, getViewer } from "./data";
import type { Post, Viewer } from "./types";

export type CommunityState = {
  viewer: Viewer | null;
  posts: Post[] | null;
  error: string | null;
};

export function useCommunityFeed() {
  const status = useAuthStatus();
  const session = useSession();
  const [state, setState] = useState<CommunityState>({ viewer: null, posts: null, error: null });
  const run = useRef(0);

  const reload = useCallback(async () => {
    const ticket = ++run.current;
    try {
      const viewer = await getViewer();
      const posts = viewer ? await getFeed(viewer) : [];
      if (ticket === run.current) setState({ viewer, posts, error: null });
    } catch (err) {
      if (ticket === run.current) {
        setState((s) => ({ ...s, posts: s.posts ?? [], error: err instanceof Error ? err.message : "Couldn't load the community." }));
      }
    }
  }, []);

  // Refetch when auth resolves and whenever the account (or its dogs) changes.
  const accountKey = session ? `${session.role}:${(session.dogs ?? []).map((d) => d.name).join(",")}:${session.accountPhoto ?? ""}` : "";
  useEffect(() => {
    if (status === "loading") return;
    void reload();
  }, [status, accountKey, reload]);

  const setPosts = useCallback((update: (prev: Post[]) => Post[]) => {
    setState((s) => ({ ...s, posts: update(s.posts ?? []) }));
  }, []);

  const markGuidelinesAccepted = useCallback(() => {
    setState((s) => (s.viewer ? { ...s, viewer: { ...s.viewer, guidelinesAccepted: true } } : s));
  }, []);

  return { ...state, loading: status === "loading" || state.posts === null, reload, setPosts, markGuidelinesAccepted };
}
