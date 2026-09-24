import type { Notification } from "@/data/inbox/types";
import { sampleMemberNotifications, sampleTrainerNotifications } from "./sample";

export type { Notification } from "@/data/inbox/types";

export async function getNotifications(asTrainer: boolean): Promise<Notification[]> {
  // TODO(backend): select * from notifications where recipient_id = auth.uid() or recipient_id is null
  // order by created_at desc (see the website's lib/inbox/schema.sql).
  const list = asTrainer ? sampleTrainerNotifications : sampleMemberNotifications;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  // TODO(backend): update notifications set read_at = now() where id = any($1).
  void ids;
}
