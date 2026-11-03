import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { getNotifications, markNotificationsRead, subscribeToNotifications, type Notification } from "@/data/notifications";

type State = {
  notifications: Notification[] | null;
  unread: number;
  reload: () => Promise<void>;
  /** Marks everything read (called when the list is opened). */
  markAllRead: () => void;
};

const Ctx = createContext<State>({ notifications: null, unread: 0, reload: async () => {}, markAllRead: () => {} });

/**
 * Your notifications (the `notifications` table) and the unread count the
 * top bar's bell shows: live over Realtime as one arrives, and again each
 * time the app comes back to the front.
 */
export function NotificationsProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setNotifications(null);
      return;
    }
    try {
      setNotifications(await getNotifications());
    } catch {
      setNotifications((prev) => prev ?? []);
    }
  }, [userId]);

  useEffect(() => {
    reload();
    if (!userId) return;
    const unsubscribe = subscribeToNotifications(userId, () => void reload());
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [reload, userId]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      if (!prev) return prev;
      const unreadIds = prev.filter((n) => !n.readAt).map((n) => n.id);
      if (unreadIds.length === 0) return prev;
      markNotificationsRead(unreadIds).catch(() => {});
      const now = new Date().toISOString();
      return prev.map((n) => (n.readAt ? n : { ...n, readAt: now }));
    });
  }, []);

  const unread = notifications?.filter((n) => !n.readAt).length ?? 0;
  return <Ctx.Provider value={{ notifications, unread, reload, markAllRead }}>{children}</Ctx.Provider>;
}

export const useNotifications = () => useContext(Ctx);
