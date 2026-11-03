"use client";

/**
 * One post in the community feed — the Kanvas Academy Student Home post card
 * in Nelly & Nova's colours: author (dog names, or the team with the official
 * tick), PINNED pill, timestamp, the "…" menu (Edit / Report / Block / Pin /
 * Delete), title and body with See More, the media grid, the Like pill and
 * the comments with the box to write one.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { VerifiedTick } from "./VerifiedTick";
import {
  acceptGuidelines,
  addComment,
  blockUser,
  deleteComment,
  deletePost,
  reportContent,
  setLiked,
  setPinned,
  unblockUser,
  updateComment,
  updatePostText,
} from "@/lib/community/data";
import { REPORT_REASONS, type Comment, type Post, type ReportReason, type Viewer } from "@/lib/community/types";

const BODY_TRUNCATE_LENGTH = 220;

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Editing text in place — your own comment, or a post's title and body.
 * Deliberately just the words: photos stay as they were.
 */
function InlineEditor({
  initialValue,
  initialTitle,
  withTitle = false,
  placeholder,
  onSave,
  onCancel,
}: {
  initialValue: string;
  initialTitle?: string;
  withTitle?: boolean;
  placeholder: string;
  onSave: (body: string, title: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const unchanged = value.trim() === initialValue.trim() && title.trim() === (initialTitle ?? "").trim();
  const empty = !value.trim() && !title.trim();

  function save() {
    setError(null);
    startTransition(async () => {
      const failure = await onSave(value.trim(), title.trim());
      if (failure) setError(failure);
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {withTitle && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={pending}
          placeholder="Title (optional)"
          className="rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm font-semibold text-paper outline-none placeholder:text-paper-dim focus:border-white/40"
        />
      )}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
        rows={3}
        placeholder={placeholder}
        className="rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper outline-none placeholder:text-paper-dim focus:border-white/40"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || unchanged || empty}
          className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className="text-xs text-paper-dim hover:text-paper">
          Cancel
        </button>
      </div>
    </div>
  );
}

function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, onClose]);
  return ref;
}

/**
 * The report form, shown in place of the menu once "Report" is picked:
 * a reason to choose and an optional note. Sends straight to the trainers.
 */
function ReportForm({
  target,
  onDone,
  onCancel,
}: {
  target: { postId: string } | { commentId: string };
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Pick a reason.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await reportContent(target, reason, details);
        onDone();
      } catch (err) {
        setError(errorText(err, "Couldn't send the report."));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 p-3">
      <p className="text-sm font-medium text-paper">Report to Nelly &amp; Nova</p>
      {REPORT_REASONS.map((r) => (
        <label key={r.value} className="flex items-center gap-2 text-sm text-paper">
          <input
            type="radio"
            name="reason"
            value={r.value}
            checked={reason === r.value}
            onChange={() => setReason(r.value)}
            className="accent-white"
          />
          {r.label}
        </label>
      ))}
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={2}
        placeholder="Anything else the trainers should know? (optional)"
        className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-ink px-3 py-2 text-xs text-paper outline-none placeholder:text-paper-dim focus:border-white/40"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-paper-dim hover:text-paper"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}

/**
 * The "…" menu on a post or comment. Your own gets Edit and Delete; someone
 * else's gets Report and Block (plus Delete for a trainer, and Pin on posts).
 * Report opens the reason form in the same popover; Block asks first.
 */
function ContentMenu({
  viewer,
  target,
  authorId,
  authorName,
  authorIsTrainer,
  isMine,
  canDelete,
  pinned,
  onEdit,
  onDelete,
  onTogglePin,
  onBlocked,
  onReported,
  size = "md",
}: {
  viewer: Viewer;
  target: { postId: string } | { commentId: string };
  authorId: string;
  authorName: string;
  authorIsTrainer: boolean;
  isMine: boolean;
  canDelete: boolean;
  pinned?: boolean;
  /** Given for your own post or comment — opens it for editing in place. */
  onEdit?: () => void;
  onDelete: () => void;
  /** Posts only, and only shown to trainers. */
  onTogglePin?: () => void;
  onBlocked: () => void;
  onReported: () => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "report" | "block">("menu");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useClickOutside(open, () => {
    setOpen(false);
    setMode("menu");
  });

  function close() {
    setOpen(false);
    setMode("menu");
    setError(null);
  }

  function confirmBlock() {
    startTransition(async () => {
      try {
        await blockUser(viewer.id, authorId);
        close();
        onBlocked();
      } catch (err) {
        setError(errorText(err, "Couldn't block."));
      }
    });
  }

  const isPost = "postId" in target;
  const dot = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const item = "w-full px-4 py-2.5 text-left text-sm text-paper transition-colors hover:bg-white/5";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={isPost ? "Post options" : "Comment options"}
        onClick={() => setOpen((v) => !v)}
        className={`flex ${dot} items-center justify-center rounded-full text-paper-dim transition-colors hover:bg-white/10 hover:text-paper active:text-paper`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <circle cx="4" cy="10" r="1.4" />
          <circle cx="10" cy="10" r="1.4" />
          <circle cx="16" cy="10" r="1.4" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute right-0 top-8 z-10 overflow-hidden rounded-xl border border-white/10 bg-ink-raised shadow-lg ${
            mode === "menu" ? "w-40" : "w-72"
          }`}
        >
          {mode === "menu" && (
            <div className="flex flex-col">
              {isMine && onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onEdit();
                  }}
                  className={item}
                >
                  Edit
                </button>
              )}
              {viewer.isTrainer && onTogglePin && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onTogglePin();
                  }}
                  className={item}
                >
                  {pinned ? "Unpin" : "Pin to top"}
                </button>
              )}
              {!isMine && (
                <>
                  <button type="button" onClick={() => setMode("report")} className={item}>
                    Report
                  </button>
                  {!authorIsTrainer && (
                    <button type="button" onClick={() => setMode("block")} className={item}>
                      Block {authorName.split(" ")[0]}
                    </button>
                  )}
                </>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(isPost ? "Delete this post? This can't be undone." : "Delete this comment?")) return;
                    close();
                    onDelete();
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 active:bg-red-500/20"
                >
                  Delete
                </button>
              )}
            </div>
          )}

          {mode === "report" && (
            <ReportForm
              target={target}
              onCancel={() => setMode("menu")}
              onDone={() => {
                close();
                onReported();
              }}
            />
          )}

          {mode === "block" && (
            <div className="flex flex-col gap-2 p-3">
              <p className="text-sm font-medium text-paper">Block {authorName}?</p>
              <p className="text-xs text-paper-dim">
                You won&apos;t see their posts or comments any more. They won&apos;t be told.
              </p>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMode("menu")}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-paper-dim hover:text-paper"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBlock}
                  disabled={pending}
                  className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {pending ? "Blocking…" : "Block"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LikeButton({
  viewer,
  postId,
  likeCount,
  likedByMe,
}: {
  viewer: Viewer;
  postId: string;
  likeCount: number;
  likedByMe: boolean;
}) {
  const [liked, setLikedState] = useState(likedByMe);
  const [count, setCount] = useState(likeCount);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !liked;
    setLikedState(next);
    setCount((c) => c + (next ? 1 : -1));

    startTransition(async () => {
      try {
        await setLiked(viewer.id, postId, next);
      } catch {
        setLikedState(!next);
        setCount((c) => c + (next ? -1 : 1));
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={liked}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        liked
          ? "border-white/40 bg-white/10 text-paper"
          : "border-white/10 text-paper-dim hover:border-white/30 hover:text-paper active:bg-white/10 active:text-paper"
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 18h7.2c.7 0 1.3-.5 1.5-1.2l1.4-5.3c.2-.9-.4-1.7-1.3-1.7H12l.6-3.4c.2-1-.6-1.9-1.6-1.9-.4 0-.7.2-.9.5L7 9.5"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 9.5V18H4a1 1 0 0 1-1-1v-6.5a1 1 0 0 1 1-1h3Z" />
      </svg>
      {count > 0 ? count : "Like"}
    </button>
  );
}

/** The one-time Community Guidelines agreement, shared with the composer. */
export function GuidelinesCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-xs text-paper-dim">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-white"
      />
      <span>
        I agree to the{" "}
        <Link href="/community-guidelines" target="_blank" className="underline underline-offset-2 hover:text-paper">
          Community Guidelines
        </Link>
        . Bullying, abuse, or anything unkind isn&apos;t tolerated and will be removed.
      </span>
    </label>
  );
}

function CommentsSection({
  viewer,
  postId,
  initialComments,
  onGuidelinesAccepted,
  onBlocked,
  onNotice,
}: {
  viewer: Viewer;
  postId: string;
  initialComments: Comment[];
  onGuidelinesAccepted: () => void;
  onBlocked: (authorId: string) => void;
  onNotice: (message: string) => void;
}) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  // Which comment is open for editing, if any — your own only.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const accepted = viewer.guidelinesAccepted;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;

    if (!accepted && !agree) {
      setError("Please agree to the Community Guidelines first.");
      return;
    }

    setError(null);
    setText("");

    startTransition(async () => {
      try {
        if (!accepted) {
          await acceptGuidelines(viewer.id);
          onGuidelinesAccepted();
        }
        const comment = await addComment(viewer, postId, body);
        setComments((prev) => [...prev, comment]);
      } catch (err) {
        setError(errorText(err, "Could not post your comment."));
        setText(body);
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
      {comments.length > 0 && (
        <p className="text-sm font-medium text-paper-dim">
          {comments.length} Comment{comments.length === 1 ? "" : "s"}
        </p>
      )}

      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar name={c.authorName} avatarUrl={c.authorAvatarUrl} size="sm" />
          <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.04] px-3.5 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-paper">
                <span className="inline-flex items-center gap-1 align-middle">
                  {c.authorName}
                  {c.authorIsTrainer && <VerifiedTick size={13} />}
                </span>
                {c.edited && <span className="ml-2 text-xs font-normal text-paper-dim">edited</span>}
              </p>
              <ContentMenu
                size="sm"
                viewer={viewer}
                target={{ commentId: c.id }}
                authorId={c.authorId}
                authorName={c.authorName}
                authorIsTrainer={c.authorIsTrainer}
                isMine={c.isMine}
                canDelete={c.canDelete}
                onEdit={() => setEditingId(c.id)}
                onDelete={() => {
                  setComments((prev) => prev.filter((x) => x.id !== c.id));
                  deleteComment(c.id).catch(() => {
                    setComments((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
                    onNotice("Couldn't delete that comment.");
                  });
                }}
                onBlocked={() => {
                  setComments((prev) => prev.filter((x) => x.authorId !== c.authorId));
                  onBlocked(c.authorId);
                }}
                onReported={() => onNotice("Thanks — a trainer will take a look.")}
              />
            </div>
            {editingId === c.id ? (
              <InlineEditor
                initialValue={c.body}
                placeholder="Write a comment…"
                onCancel={() => setEditingId(null)}
                onSave={async (next) => {
                  try {
                    await updateComment(c.id, next);
                  } catch (err) {
                    return errorText(err, "Could not save that edit.");
                  }
                  setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, body: next, edited: true } : x)));
                  setEditingId(null);
                  return null;
                }}
              />
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm text-paper-dim">{c.body}</p>
                <p className="mt-1 text-xs text-paper-dim/70">{c.createdAtLabel}</p>
              </>
            )}
          </div>
        </div>
      ))}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {!accepted && <GuidelinesCheckbox checked={agree} onChange={setAgree} />}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-ink px-4 py-2 text-sm text-paper outline-none placeholder:text-paper-dim focus:border-white/40"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-paper transition-colors hover:border-white/40 active:bg-white/10 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// Posts don't sit inside their own bordered card, so media gets its own
// rounded, clipped edge. A single item shows at its natural size (no
// cropping); more than one tiles into a cropped two-up grid.
function MediaGrid({ media }: { media: Post["media"] }) {
  if (media.length === 0) return null;

  if (media.length === 1) {
    const item = media[0];
    return (
      <div className="mt-3 overflow-hidden rounded-xl">
        {item.type === "video" ? (
          <video src={item.url} controls playsInline className="block w-full bg-black" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" className="block w-full" />
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
      {media.map((item, i) =>
        item.type === "video" ? (
          <video key={i} src={item.url} controls playsInline className="aspect-square w-full bg-black object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={item.url} alt="" className="aspect-square w-full object-cover" />
        )
      )}
    </div>
  );
}

function PostBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = body.length > BODY_TRUNCATE_LENGTH;
  const shown = expanded || !isLong ? body : body.slice(0, BODY_TRUNCATE_LENGTH).trimEnd() + "…";

  return (
    <div className="mt-3 text-sm text-paper">
      <p className="whitespace-pre-wrap">{shown}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 font-medium text-paper-dim transition-colors hover:text-paper active:text-paper active:underline"
        >
          {expanded ? "See Less" : "See More"}
        </button>
      )}
    </div>
  );
}

export function PostCard({
  post,
  viewer,
  onDeleted,
  onPinnedChange,
  onGuidelinesAccepted,
}: {
  post: Post;
  viewer: Viewer;
  onDeleted: (postId: string) => void;
  onPinnedChange: (postId: string, pinned: boolean) => void;
  onGuidelinesAccepted: () => void;
}) {
  const [blockedAuthor, setBlockedAuthor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Editing your own words in place — title and body, nothing else.
  const [editingPost, setEditingPost] = useState(false);
  const [text, setText] = useState({ title: post.title ?? "", body: post.body });

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Blocking the post's author hides the whole post straight away; the
  // database keeps it hidden on the next load.
  if (blockedAuthor && blockedAuthor === post.authorId) {
    return (
      <p className="text-sm text-paper-dim">
        You&apos;ve blocked {post.authorName}.{" "}
        <button
          type="button"
          onClick={async () => {
            try {
              await unblockUser(viewer.id, post.authorId);
              setBlockedAuthor(null);
            } catch {
              setNotice("Couldn't undo that — please try again.");
            }
          }}
          className="underline underline-offset-2 hover:text-paper"
        >
          Undo
        </button>
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={post.authorName} avatarUrl={post.authorAvatarUrl} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="flex min-w-0 items-center gap-1 text-sm font-medium text-paper">
                <span className="truncate">{post.authorName}</span>
                {/* A trainer: the blue official tick, as on Instagram. */}
                {post.authorIsTrainer && <VerifiedTick size={15} />}
              </p>
              {post.pinned && (
                <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-paper-dim">
                  Pinned
                </span>
              )}
            </div>
            <p className="text-xs text-paper-dim">{post.createdAtLabel}</p>
          </div>
        </div>

        <ContentMenu
          viewer={viewer}
          target={{ postId: post.id }}
          authorId={post.authorId}
          authorName={post.authorName}
          authorIsTrainer={post.authorIsTrainer}
          isMine={post.isMine}
          canDelete={post.canDelete}
          pinned={post.pinned}
          onEdit={() => setEditingPost(true)}
          onTogglePin={async () => {
            try {
              await setPinned(post.id, !post.pinned);
              onPinnedChange(post.id, !post.pinned);
            } catch (err) {
              setNotice(errorText(err, "Couldn't change the pin."));
            }
          }}
          onDelete={async () => {
            try {
              await deletePost(post.id);
              onDeleted(post.id);
            } catch (err) {
              setNotice(errorText(err, "Couldn't delete that post."));
            }
          }}
          onBlocked={() => setBlockedAuthor(post.authorId)}
          onReported={() => setNotice("Thanks — a trainer will take a look.")}
        />
      </div>

      {notice && (
        <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">{notice}</p>
      )}

      {editingPost ? (
        <InlineEditor
          initialValue={text.body}
          initialTitle={text.title}
          withTitle
          placeholder="What's on your mind?"
          onCancel={() => setEditingPost(false)}
          onSave={async (nextBody, nextTitle) => {
            try {
              await updatePostText(post.id, nextTitle, nextBody);
            } catch (err) {
              return errorText(err, "Could not save that edit.");
            }
            setText({ title: nextTitle, body: nextBody });
            setEditingPost(false);
            return null;
          }}
        />
      ) : (
        <>
          {!!text.title && <h3 className="mt-4 text-base font-semibold text-paper">{text.title}</h3>}
          {!!text.body && <PostBody body={text.body} />}
        </>
      )}

      <MediaGrid media={post.media} />

      <div className="mt-4 flex items-center gap-3">
        <LikeButton viewer={viewer} postId={post.id} likeCount={post.likeCount} likedByMe={post.likedByMe} />
      </div>

      <CommentsSection
        viewer={viewer}
        postId={post.id}
        initialComments={post.comments}
        onGuidelinesAccepted={onGuidelinesAccepted}
        onBlocked={(authorId) => {
          if (authorId === post.authorId) setBlockedAuthor(authorId);
          else setNotice("Blocked. Their comments are hidden from you now.");
        }}
        onNotice={setNotice}
      />
    </div>
  );
}
