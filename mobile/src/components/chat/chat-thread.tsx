import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, FlatList, Keyboard, Platform, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { AvatarCircle } from "@/components/avatar-circle";
import { AttachSheet, type ShareRow } from "@/components/chat/attach-sheet";
import { AttachmentContent } from "@/components/chat/attachment-content";
import { MAX_STAGED, StagedAttachments, type StagedAttachment } from "@/components/chat/staged-attachments";
import { Pressable } from "@/components/pressable";
import {
  chatHeartbeat,
  findOpenEnquiry,
  getMessages,
  getMessagesSince,
  markChatRead,
  sendMessage,
  sendOnboardingLink,
  subscribeToMessages,
  toMessages,
  type Attachment,
  type Message,
} from "@/data/inbox";
import { parseChatBody } from "@/lib/chat-links";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { useBarScrollTarget } from "@/lib/floating-bar";
import { hapticError, hapticSuccess, hapticTap, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { useAsync } from "@/lib/useAsync";
import { colors, GLASS_BORDER } from "@/theme";

/** Who has this conversation open — the same presence channel as the website's chat. */
type ChatPresence = { role: "member" | "staff"; name: string; typing: boolean };
const TYPING_IDLE_MS = 3000;

/**
 * "Charlotte is typing…" / "Kane is in this chat" — trainers only, so two
 * of them don't answer the same person. Owners never see this.
 */
function presenceSummary(others: ChatPresence[], viewerIsStaff: boolean): string | null {
  if (!viewerIsStaff || others.length === 0) return null;
  const unique = (list: ChatPresence[]) => [...new Set(list.map((p) => p.name))];
  const join = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
  const typing = unique(others.filter((p) => p.typing));
  if (typing.length > 0) return `${join(typing)} ${typing.length === 1 ? "is" : "are"} typing…`;
  const here = unique(others);
  return `${join(here)} ${here.length === 1 ? "is" : "are"} in this chat`;
}

/** A trainer's message can carry links ([text](https://…) or pasted); an owner's is always plain text. */
function MessageBody({ body, linkify, color, paddingHorizontal }: { body: string; linkify: boolean; color: string; paddingHorizontal: number }) {
  if (!linkify) return <Text style={{ color, fontSize: 14, paddingHorizontal }}>{body}</Text>;
  return (
    <Text style={{ color, fontSize: 14, paddingHorizontal }}>
      {parseChatBody(body).map((part, i) =>
        part.type === "link" ? (
          <Text key={i} style={{ color, fontWeight: "600", textDecorationLine: "underline" }} onPress={() => WebBrowser.openBrowserAsync(part.href)}>
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        )
      )}
    </Text>
  );
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DIVIDER_GAP_MS = 5 * 60 * 1000;

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} · ${hours}:${minutes}`;
}

function needsDivider(current: Message, previous: Message | undefined): boolean {
  if (!previous) return true;
  return new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() > DIVIDER_GAP_MS;
}

/**
 * Folds freshly-arrived messages (Realtime or the back-up poll) into the
 * list — by id, so the same message arriving twice is shown once, and one of
 * ours that's still sending is replaced rather than duplicated.
 */
function mergeMessages(prev: Message[], incoming: Message[], viewerIsStaff: boolean): Message[] {
  let next = prev;
  for (const message of incoming) {
    const existing = next.findIndex((m) => m.id === message.id);
    if (existing !== -1) {
      next = next.map((m, i) => (i === existing ? { ...message, attachment: m.attachment ?? message.attachment } : m));
      continue;
    }
    if (message.fromStaff === viewerIsStaff) {
      const pending = next.findIndex(
        (m) => m.pending && m.body === message.body && (m.attachment?.name ?? null) === (message.attachment?.name ?? null)
      );
      if (pending !== -1) {
        next = next.map((m, i) => (i === pending ? { ...message, attachment: m.attachment ?? message.attachment } : m));
        continue;
      }
    }
    next = [...next, message];
  }
  return next === prev ? prev : [...next].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const POLL_MS = 5000;
const HEARTBEAT_MS = 30 * 1000;

type RowMessage = Message & { showDivider: boolean; showSenderLabel: boolean };

// One line at rest; grows to about five lines, then scrolls inside.
const COMPOSER_MIN_HEIGHT = 44;
const COMPOSER_MAX_HEIGHT = 22 * 5 + 20;

/**
 * One conversation, laid out like the Kanvas app's chat: time dividers,
 * team bubbles with the sender's avatar and name, your own bubbles in the
 * accent colour, and the composer at the bottom. The + opens "Add to
 * message"; what's picked waits in a tray above the field until Send.
 *
 * `viewerIsStaff` picks the side: a member gets one tidy row (field, attach,
 * send); a trainer gets the full-width field with a toolbar underneath, who
 * else is in the chat ("Charlotte is typing…"), "Seen" under their latest
 * message, and — in an owner's chat — onboarding, meet & greet and review
 * links in the + sheet.
 */
export function ChatThread({
  conversationId,
  viewerIsStaff,
  locked = false,
  lockedMessage,
  emptyLabel = "No messages yet — say hello!",
  bottomInset = 0,
  owner,
  memberLastReadAt,
}: {
  conversationId: string;
  viewerIsStaff: boolean;
  /** Hides the composer — a completed conversation on the trainer side. */
  locked?: boolean;
  lockedMessage?: string | null;
  emptyLabel?: string;
  /**
   * Room kept at the bottom while the keyboard is down — the floating bar's
   * on the Chat tab (lib/floating-bar.tsx). The bar hides for the keyboard,
   * so with it up the keyboard's own measure rules.
   */
  bottomInset?: number;
  /** Trainer, an owner's chat: whose it is, for the + sheet's links. */
  owner?: { accountId: string; email?: string | null };
  /** Trainer only: when the owner last read their chat (undefined hides "Seen"). */
  memberLastReadAt?: string | null;
}) {
  const { session, profile } = useAuth();
  const viewerId = session?.user.id ?? "";
  const presenceName = profile?.ownerName || (viewerIsStaff ? "Nelly & Nova" : "Owner");
  // Tapping Chat again in the bar: back to the newest messages.
  const barScrollTarget = useBarScrollTarget();
  const { data: loaded } = useAsync(() => getMessages(conversationId), [conversationId]);
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    if (loaded) setMessages(loaded);
  }, [loaded]);

  useEffect(() => {
    markChatRead(conversationId, viewerIsStaff).catch(() => {});
  }, [conversationId, viewerIsStaff]);

  // Live: new messages arrive over Realtime, with a poll every few seconds
  // as a back-up in case one is ever missed (same as the website).
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    const fold = (incoming: Message[]) => {
      if (incoming.length === 0) return;
      setMessages((prev) => mergeMessages(prev, incoming, viewerIsStaff));
      if (incoming.some((m) => m.fromStaff !== viewerIsStaff)) markChatRead(conversationId).catch(() => {});
    };
    const unsubscribe = subscribeToMessages(conversationId, (row) => {
      toMessages([row]).then(fold).catch(() => {});
    });
    const poll = setInterval(() => {
      if (AppState.currentState !== "active") return;
      const lastReal = [...messagesRef.current].reverse().find((m) => !m.pending);
      getMessagesSince(conversationId, lastReal?.createdAt ?? new Date(0).toISOString())
        .then(fold)
        .catch(() => {});
    }, POLL_MS);
    return () => {
      unsubscribe();
      clearInterval(poll);
    };
  }, [conversationId, viewerIsStaff]);

  // An owner's chat says "I'm here" while it's open, like on the website.
  useEffect(() => {
    if (viewerIsStaff) return;
    const beat = () => {
      if (AppState.currentState === "active") chatHeartbeat().catch(() => {});
    };
    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [viewerIsStaff, conversationId]);

  // Presence: everyone with this conversation open shares one channel (the
  // website's too), keyed per device so two of one person's don't clash.
  const [others, setOthers] = useState<ChatPresence[]>([]);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const role: ChatPresence["role"] = viewerIsStaff ? "staff" : "member";
  useEffect(() => {
    if (!viewerId) return;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    try {
      channel = supabase.channel(`presence:${conversationId}`, { config: { presence: { key: `${viewerId}:${randomId()}` } } });
      presenceChannelRef.current = channel;
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<ChatPresence>();
          setOthers(
            Object.entries(state)
              .filter(([key]) => !key.startsWith(`${viewerId}:`))
              .flatMap(([, entries]) => entries)
              .map((e) => ({ role: e.role, name: e.name, typing: e.typing }))
          );
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") await channel!.track({ role, name: presenceName, typing: false });
        });
    } catch {
      // Presence is a nicety; the chat works without it.
    }
    return () => {
      presenceChannelRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, viewerId, role, presenceName]);

  const setTyping = useCallback(
    (typing: boolean) => {
      if (typingRef.current === typing) return;
      typingRef.current = typing;
      presenceChannelRef.current?.track({ role, name: presenceName, typing }).catch(() => {});
    },
    [role, presenceName]
  );

  // Trainer: is there an open enquiry to send an onboarding link from?
  const [enquiryId, setEnquiryId] = useState<string | null>(null);
  const ownerAccountId = owner?.accountId;
  const ownerEmail = owner?.email ?? null;
  useEffect(() => {
    if (!viewerIsStaff || !ownerAccountId) return;
    let cancelled = false;
    findOpenEnquiry(ownerAccountId, ownerEmail)
      .then((id) => {
        if (!cancelled) setEnquiryId(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [viewerIsStaff, ownerAccountId, ownerEmail]);

  // How far the keyboard overlaps this thread, measured against where the
  // thread really ends on screen — right whether the tab bar is under it or not.
  const rootRef = useRef<View>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const onFrame = (e: { endCoordinates: { screenY: number } }) => {
      const keyboardTop = e.endCoordinates.screenY;
      rootRef.current?.measureInWindow((_x, y, _w, h) => setKeyboardInset(Math.max(0, Math.round(y + h - keyboardTop))));
    };
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", (e) => {
      setKeyboardUp(true);
      onFrame(e);
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      setKeyboardUp(false);
      setKeyboardInset(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inputHeight, setInputHeight] = useState(COMPOSER_MIN_HEIGHT);

  function handleDraftChange(text: string) {
    setDraft(text);
    if (!text.trim()) {
      setTyping(false);
      return;
    }
    setTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setTyping(false), TYPING_IDLE_MS);
  }

  /** Sends one message (text, an attachment, or both), shown at once and confirmed when it lands. */
  async function sendOne(body: string, attachment: Attachment | undefined, tempId: string): Promise<boolean> {
    try {
      const saved = await sendMessage(conversationId, body, viewerIsStaff, attachment);
      // Realtime may already have delivered it — then just drop the temp copy.
      setMessages((prev) =>
        prev.some((m) => m.id === saved.id) ? prev.filter((m) => m.id !== tempId) : prev.map((m) => (m.id === tempId ? saved : m))
      );
      return true;
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return false;
    }
  }

  /**
   * Sends what's typed and what's waiting in the tray: one message per
   * attachment (the backend holds one each), in the order they were added,
   * with the typed text as the first one's caption. Whatever doesn't go is
   * put back to try again: files in the tray, words in the box.
   */
  async function handleSend() {
    const body = draft.trim();
    if (sending || (!body && staged.length === 0)) return;
    const items = staged;
    const steps = items.length
      ? items.map((item, i) => ({
          tempId: `temp-${randomId()}`,
          body: i === 0 ? body : "",
          item,
          attachment: { type: item.type, url: item.uri, name: item.name ?? "File", mimeType: item.mimeType } as Attachment,
        }))
      : [{ tempId: `temp-${randomId()}`, body, item: null, attachment: undefined }];

    const startedAt = Date.now();
    setMessages((prev) => [
      ...prev,
      ...steps.map((step, i): Message => ({
        id: step.tempId,
        conversationId,
        body: step.body,
        fromStaff: viewerIsStaff,
        senderId: viewerId,
        createdAt: new Date(startedAt + i).toISOString(),
        pending: true,
        attachment: step.attachment,
      })),
    ]);
    setDraft("");
    setStaged([]);
    setError(null);
    setTyping(false);
    setSending(true);
    hapticTap();

    const failed: StagedAttachment[] = [];
    let textFailed = false;
    for (const step of steps) {
      const ok = await sendOne(step.body, step.attachment, step.tempId);
      if (!ok) {
        if (step.item) failed.push(step.item);
        if (step.body) textFailed = true;
      }
    }
    if (failed.length > 0 || textFailed) {
      hapticError();
      if (failed.length > 0) setStaged((prev) => [...failed, ...prev].slice(0, MAX_STAGED));
      if (textFailed) setDraft((current) => current || body);
      setError(failed.length > 1 ? `Could not send ${failed.length} files — please try again.` : "Could not send that — please try again.");
    }
    setSending(false);
  }

  function openAttachSheet() {
    if (staged.length >= MAX_STAGED) {
      hapticWarning();
      setError(`You can add up to ${MAX_STAGED} at a time — send these first.`);
      return;
    }
    Keyboard.dismiss();
    setAttachSheetOpen(true);
  }

  function addStaged(items: StagedAttachment[]) {
    setAttachSheetOpen(false);
    const room = MAX_STAGED - staged.length;
    animateListChange();
    setStaged((prev) => [...prev, ...items].slice(0, MAX_STAGED));
    setError(items.length > room ? `You can add up to ${MAX_STAGED} at a time — ${items.length - room} of those weren't added.` : null);
  }

  function removeStaged(key: string) {
    animateListChange();
    setStaged((prev) => prev.filter((item) => item.key !== key));
  }

  /** A link from the + sheet, after whatever's already typed, ready to add to before sending. */
  function addToDraft(text: string) {
    setAttachSheetOpen(false);
    setDraft((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text));
  }

  function confirmOnboarding() {
    setAttachSheetOpen(false);
    if (!enquiryId) return;
    // One sheet at a time: the question shows once this one has slid away.
    setTimeout(() => {
      Alert.alert("Send their onboarding link?", "It goes in this chat and by email, with their Direct Debit set-up.", [
        { text: "Not now", style: "cancel" },
        {
          text: "Send",
          onPress: () => {
            sendOnboardingLink(enquiryId).then(hapticSuccess, (err: unknown) => {
              hapticError();
              setError(err instanceof Error ? err.message : "Couldn't send the onboarding link.");
            });
          },
        },
      ]);
    }, 400);
  }

  const shareRows: ShareRow[] =
    viewerIsStaff && owner
      ? [
          ...(enquiryId ? [{ key: "onboarding", icon: "link-outline" as const, label: "Send onboarding link", onPress: confirmOnboarding }] : []),
          { key: "book", icon: "calendar-outline", label: "Book a meet & greet link", onPress: () => addToDraft(`[Book a meet & greet](${config.siteUrl}/book)`) },
          { key: "review", icon: "star-outline", label: "Leave a review link", onPress: () => addToDraft(`[Leave us a review](${config.siteUrl}/review)`) },
        ]
      : [];

  const canSend = !sending && (!!draft.trim() || staged.length > 0);
  const presenceLine = presenceSummary(others, viewerIsStaff);

  // "Seen" goes under our latest message, unless they've written since (a
  // reply says they've seen it). One way: only a trainer gets this.
  let seen: { id: string; label: string } | null = null;
  if (viewerIsStaff && memberLastReadAt !== undefined) {
    const lastOurs = [...messages].reverse().find((m) => m.fromStaff && !m.pending);
    const theyWroteSince = lastOurs && messages.some((m) => !m.fromStaff && m.createdAt > lastOurs.createdAt);
    if (lastOurs && !theyWroteSince) {
      const read = !!memberLastReadAt && memberLastReadAt >= lastOurs.createdAt;
      seen = { id: lastOurs.id, label: read ? `Seen ${formatMessageTime(memberLastReadAt!)}` : "Not opened yet" };
    }
  }

  function isMineMessage(message: Message): boolean {
    return message.senderId && viewerId ? message.senderId === viewerId : message.fromStaff === viewerIsStaff;
  }

  const rows: RowMessage[] = messages.map((message, i) => {
    const showDivider = needsDivider(message, messages[i - 1]);
    // A trainer's message from someone else gets a name and photo on the
    // first bubble of a run — an owner sees the team; a trainer, their colleagues.
    const theirsFromStaff = message.fromStaff && !isMineMessage(message);
    const showSenderLabel =
      theirsFromStaff && (showDivider || i === 0 || !messages[i - 1].fromStaff || (messages[i - 1].senderId ?? messages[i - 1].senderName) !== (message.senderId ?? message.senderName));
    return { ...message, showDivider, showSenderLabel };
  });

  const textInput = (fontSize: number, extraStyle: object) => (
    <TextInput
      value={draft}
      onChangeText={handleDraftChange}
      multiline
      onContentSizeChange={(e) => setInputHeight(Math.min(COMPOSER_MAX_HEIGHT, Math.max(COMPOSER_MIN_HEIGHT, e.nativeEvent.contentSize.height + 20)))}
      placeholder={staged.length > 0 ? "Add a message…" : "Type a message…"}
      placeholderTextColor={colors.muted}
      style={{
        height: draft ? inputHeight : COMPOSER_MIN_HEIGHT,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        color: colors.foreground,
        fontSize,
        lineHeight: 22,
        textAlignVertical: "top",
        ...extraStyle,
      }}
    />
  );

  return (
    <View ref={rootRef} style={{ flex: 1, paddingBottom: keyboardUp ? keyboardInset : bottomInset, backgroundColor: colors.background }}>
      <FlatList
        ref={barScrollTarget}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: rows.length === 0 ? "center" : undefined }}
        data={[...rows].reverse()}
        inverted
        keyExtractor={(m) => m.id}
        extraData={seen}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loaded ? (
            <Text style={{ color: colors.muted, textAlign: "center", transform: [{ scaleY: -1 }] }}>{emptyLabel}</Text>
          ) : (
            <ActivityIndicator color={colors.foreground} />
          )
        }
        renderItem={({ item: message }) => {
          const isMine = isMineMessage(message);
          const showAvatarColumn = !isMine && message.fromStaff;
          return (
            <View style={{ marginBottom: 4 }}>
              {message.showDivider && (
                <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", marginVertical: 10 }}>{formatMessageTime(message.createdAt)}</Text>
              )}
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, justifyContent: isMine ? "flex-end" : "flex-start" }}>
                {showAvatarColumn && (
                  <View style={{ width: 26, height: 26 }}>
                    {message.showSenderLabel && <AvatarCircle name={message.senderName ?? "Nelly & Nova"} avatarUrl={message.senderAvatarUrl} size={26} />}
                  </View>
                )}
                <View style={{ maxWidth: "80%", gap: 2 }}>
                  {message.showSenderLabel && (
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "500", marginLeft: 4 }}>{message.senderName ?? "Nelly & Nova"}</Text>
                  )}
                  <View
                    style={{
                      borderRadius: 18,
                      paddingHorizontal: message.attachment ? 6 : 14,
                      paddingVertical: message.attachment ? 6 : 9,
                      backgroundColor: isMine ? colors.accent : colors.surface,
                      borderWidth: isMine ? 0 : 1,
                      ...GLASS_BORDER,
                      gap: 6,
                      opacity: message.pending ? 0.7 : 1,
                    }}
                  >
                    {message.attachment && <AttachmentContent attachment={message.attachment} mine={isMine} />}
                    {!!message.body && (
                      <MessageBody
                        body={message.body}
                        linkify={message.fromStaff}
                        color={isMine ? colors.accentForeground : colors.foreground}
                        paddingHorizontal={message.attachment ? 6 : 0}
                      />
                    )}
                  </View>
                </View>
              </View>
              {seen?.id === message.id && (
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3, marginHorizontal: 4, textAlign: "right" }}>{seen.label}</Text>
              )}
            </View>
          );
        }}
      />

      {presenceLine && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingVertical: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>{presenceLine}</Text>
        </View>
      )}

      {locked ? (
        <Text style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 14, textAlign: "center", color: colors.muted, fontSize: 13 }}>
          {lockedMessage ?? "This conversation is marked complete."}
        </Text>
      ) : !viewerIsStaff ? (
        // A member's composer: one tidy row — the text field, attach, Send —
        // with anything attached waiting in a tray above it until Send.
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          <StagedAttachments items={staged} onRemove={removeStaged} />
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
            {textInput(16, { flex: 1, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, borderRadius: 22 })}
            <Pressable onPress={openAttachSheet} accessibilityLabel="Attach" hitSlop={6} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="add-circle-outline" size={28} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityLabel="Send"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", opacity: canSend ? 1 : 0.45 }}
            >
              {sending ? <ActivityIndicator color={colors.accentForeground} size="small" /> : <Ionicons name="arrow-up" size={22} color={colors.accentForeground} />}
            </Pressable>
          </View>
        </View>
      ) : (
        // Messenger-desk layout for trainers: full-width field on top, toolbar underneath.
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          <StagedAttachments items={staged} onRemove={removeStaged} />
          {textInput(17, {})}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 10, paddingTop: 2 }}>
            <View style={{ flex: 1 }} />
            <Pressable onPress={openAttachSheet} accessibilityLabel="Attach" hitSlop={6} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="add-circle-outline" size={26} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityLabel="Send"
              style={{ height: 38, borderRadius: 19, paddingHorizontal: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", opacity: canSend ? 1 : 0.45 }}
            >
              {sending ? <ActivityIndicator color={colors.accentForeground} size="small" /> : <Text style={{ color: colors.accentForeground, fontSize: 15, fontWeight: "700" }}>Send</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {!locked && (
        <AttachSheet visible={attachSheetOpen} onClose={() => setAttachSheetOpen(false)} onAdd={addStaged} limit={MAX_STAGED - staged.length} shareRows={shareRows} />
      )}

      {error && (
        <Text
          style={{
            borderTopWidth: 1,
            borderTopColor: "rgba(225,29,51,0.3)",
            backgroundColor: "rgba(225,29,51,0.1)",
            color: colors.danger,
            fontSize: 12,
            textAlign: "center",
            padding: 8,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
