"use client";

import { useEffect, useState } from "react";
import { NotificationsList } from "./NotificationsList";
import { RequestsList } from "./RequestsList";
import { RequestDetail } from "./RequestDetail";
import { TeamInbox } from "@/components/chat/TeamInbox";
import { useSession } from "@/lib/auth/session";
import { chatSupabase } from "@/lib/chat/client";
import type { InboxRequest, Notification } from "@/lib/inbox/types";

type InboxAppProps = {
  notifications: Notification[];
  requests: InboxRequest[];
};

function Panel({
  title,
  count,
  children,
  open,
}: {
  title: string;
  count: number;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="font-semibold text-paper">{title}</span>
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/10 px-2 text-xs font-semibold text-paper">
          {count}
        </span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

export function InboxApp({ notifications, requests: initialRequests }: InboxAppProps) {
  const session = useSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [requests, setRequests] = useState(initialRequests);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  // Deep-link: /inbox?name=<owner> searches the chat list for that owner.
  const [chatSearch, setChatSearch] = useState<string | null>(null);

  useEffect(() => {
    chatSupabase()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
    const name = new URLSearchParams(window.location.search).get("name");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (name) setChatSearch(name);
  }, []);

  const openRequest = requests.find((r) => r.id === openRequestId) ?? null;

  function resolveRequest(id: string) {
    // TODO(backend): update requests.status and, on approve, notify the requester.
    setRequests((rs) => rs.filter((r) => r.id !== id));
    setOpenRequestId(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Notifications" count={notifications.filter((n) => !n.readAt).length}>
          <NotificationsList initial={notifications} />
        </Panel>
        <Panel title="Requests" count={requests.filter((r) => r.status === "pending").length} open>
          <RequestsList items={requests} onOpen={(r) => setOpenRequestId(r.id)} />
        </Panel>
      </div>

      <div className="flex h-[75vh] min-h-0 flex-col overflow-hidden rounded-3xl bg-white/[0.03] ring-1 ring-white/10">
        {userId ? (
          <TeamInbox
            key={chatSearch ?? ""}
            viewerId={userId}
            viewerName={session?.ownerName || "Nelly & Nova"}
            initialName={chatSearch}
          />
        ) : (
          <p className="m-auto text-sm text-paper-dim">Loading…</p>
        )}
      </div>

      {openRequest && (
        <RequestDetail
          request={openRequest}
          onClose={() => setOpenRequestId(null)}
          onApprove={() => resolveRequest(openRequest.id)}
          onReject={() => resolveRequest(openRequest.id)}
          onReplyChat={() => {
            setChatSearch(openRequest.requesterName);
            setOpenRequestId(null);
          }}
        />
      )}
    </div>
  );
}
