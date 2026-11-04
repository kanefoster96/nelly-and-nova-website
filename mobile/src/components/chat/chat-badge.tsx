import { useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { CountBadge } from "@/components/count-badge";
import { getChatBadgeCount } from "@/data/inbox/cards";

const REFRESH_MS = 30_000;

/**
 * The count on the Chat tab's icon: for a trainer, the conversations with
 * unread messages from owners (the Inbox's "3 unread"); for an owner, the
 * team's messages they haven't read. Checked again on every tab change,
 * when the app comes back, and every half a minute.
 */
export function ChatBadge() {
  const { isTrainer } = useAuth();
  const segments = useSegments() as string[];
  const where = segments.join("/");
  const [count, setCount] = useState(0);

  useEffect(() => {
    let live = true;
    const load = () => {
      if (AppState.currentState !== "active") return;
      getChatBadgeCount(isTrainer)
        .then((n) => live && setCount(n))
        .catch(() => undefined);
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    const appState = AppState.addEventListener("change", (state) => state === "active" && load());
    return () => {
      live = false;
      clearInterval(timer);
      appState.remove();
    };
  }, [isTrainer, where]);

  return <CountBadge count={count} />;
}
