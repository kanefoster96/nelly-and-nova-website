import { NotificationsList } from "@/components/notifications/NotificationsList";
import type { NotificationKind } from "@/lib/notifications";

const ROUTES: Partial<Record<NotificationKind, string>> = {
  chat_message: "/admin/messages",
};

export default function AdminNotificationsScreen() {
  return <NotificationsList routeFor={(kind) => ROUTES[kind]} />;
}
