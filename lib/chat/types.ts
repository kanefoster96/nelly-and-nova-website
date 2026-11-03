/**
 * Live chat types (see supabase/migrations/20261103000000_chat.sql).
 * One running conversation per member with the team; any trainer can reply.
 */

export type ChatAttachmentType = "image" | "video" | "file";

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string | null;
  /** Sent by a trainer (the business) rather than the member. */
  senderIsStaff: boolean;
  /** The trainer's name, for team messages. */
  senderName: string | null;
  senderAvatarUrl?: string | null;
  body: string;
  attachmentPath: string | null;
  attachmentType: ChatAttachmentType | null;
  attachmentName: string | null;
  /** Signed URL, resolved on demand (undefined = not resolved yet). */
  attachmentUrl?: string | null;
  createdAt: string;
};

/** Raw row from messages (Realtime payloads and selects). */
export type ChatMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_is_staff: boolean;
  sender_name: string | null;
  body: string;
  attachment_path: string | null;
  attachment_type: ChatAttachmentType | null;
  attachment_name: string | null;
  created_at: string;
};

/** "Kane is typing…" — who else has this conversation open right now. */
export type ChatPresence = {
  role: "member" | "staff";
  name: string;
  typing: boolean;
};

/** One row in the trainer inbox. */
export type InboxConversation = {
  id: string;
  userId: string;
  ownerName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  dogNames: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastFromStaff: boolean;
  unread: boolean;
  completed: boolean;
  /** The owner's chat was last open (heartbeat), for "In the chat now". */
  memberLastActiveAt: string | null;
};

export type SendInput = {
  body: string;
  attachmentPath?: string;
  attachmentType?: ChatAttachmentType;
  attachmentName?: string;
};
