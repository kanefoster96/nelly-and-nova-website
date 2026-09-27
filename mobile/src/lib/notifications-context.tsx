import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";

import { useAuth } from "@/auth/AuthProvider";
import { getNotifications, markNotificationsRead, type Notification } from "@/data/notifications";

type State = {
  notifications: Notification[] | null;
  unread: number;
  reload: () => Promise<void>;
  /** Marks everything read (called when the list is opened). */
  markAllRead: () => void;
};

const Ctx = createContext<State>({ notifications: null, unread: 0, reload: async () => {}, markAllRead: () => {} });

/** Notifications + the unread count the top bar's bell shows. */
export function NotificationsProvider({ children }: PropsWithChildren) {
  const { session, isTrainer } = useAuth();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  const reload = useCallback(async () => {
    if (!session) return setNotifications(null);
    setNotifications(await getNotifications(isTrainer));
  }, [session, isTrainer]);

  useEffect(() => {
    reload();
  }, [reload]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      if (!prev) return prev;
      const unreadIds = prev.filter((n) => !n.readAt).map((n) => n.id);
      if (unreadIds.length === 0) return prev;
      markNotificationsRead(unreadIds);
      const now = new Date().toISOString();
      return prev.map((n) => (n.readAt ? n : { ...n, readAt: now }));
    });
  }, []);

  const unread = notifications?.filter((n) => !n.readAt).length ?? 0;
  return <Ctx.Provider value={{ notifications, unread, reload, markAllRead }}>{children}</Ctx.Provider>;
}

export const useNotifications = () => useContext(Ctx);
