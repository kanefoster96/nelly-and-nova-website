"use client";

import { useState } from "react";
import { MemberChat } from "./MemberChat";
import { NotificationsList } from "./NotificationsList";
import { OnboardingList } from "./OnboardingList";
import { RescheduleRequests } from "./RescheduleRequests";
import { WhatsAppIcon } from "@/components/ui/Icons";
import { contact } from "@/config/site";
import { useReschedules } from "@/lib/reschedule/store";
import type { DayAvailability } from "@/lib/schedule/sessions";
import type { Message, Notification } from "@/lib/inbox/types";
import type { OnboardingEntry } from "@/lib/inbox/onboarding";

/**
 * Role-aware chat centre opened from the header chat button.
 * ---------------------------------------------------------
 * Tabs (pills) appear based on who's signed in:
 *   - Live Chat    — always (guests included), selected by default
 *   - Notifications — signed-in members and admins
 *   - Onboarding    — admins only (new customer pipeline)
 *
 * Roles are simulated here with a scaffold "view as" switcher — there's no
 * auth yet. TODO(backend): derive `role` from the Supabase session
 * (guest = anon, member = authed, admin = is_staff()) and drop the switcher.
 */
type Role = "guest" | "member" | "admin";
type Tab = "chat" | "notifications" | "requests" | "onboarding";

const ROLES: { id: Role; label: string }[] = [
  { id: "guest", label: "Guest" },
  { id: "member", label: "Member" },
  { id: "admin", label: "Admin" },
];

export function ChatCenter({
  conversationId,
  initialMessages,
  notifications,
  onboarding,
  avail,
}: {
  conversationId: string | null;
  initialMessages: Message[];
  notifications: Notification[];
  onboarding: OnboardingEntry[];
  avail: DayAvailability[];
}) {
  const [role, setRole] = useState<Role>("guest");
  const [tab, setTab] = useState<Tab>("chat");
  const pendingReschedules = useReschedules().filter((r) => r.status === "pending").length;

  // Which pills this role may see.
  const tabs: { id: Tab; label: string }[] = [
    { id: "chat", label: "Live Chat" },
    ...(role !== "guest"
      ? [{ id: "notifications" as Tab, label: "Notifications" }]
      : []),
    ...(role === "admin"
      ? [
          {
            id: "requests" as Tab,
            label: pendingReschedules > 0 ? `Requests (${pendingReschedules})` : "Requests",
          },
          { id: "onboarding" as Tab, label: "Onboarding" },
        ]
      : []),
  ];

  // If the active tab isn't available to this role, fall back to chat.
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "chat";

  return (
    <div>
      {/* Scaffold role switcher — remove once auth is wired. */}
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-paper-dim">
          View as
        </span>
        <div className="flex gap-1">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRole(r.id);
                setTab("chat");
              }}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                role === r.id
                  ? "bg-paper text-ink"
                  : "text-paper/70 hover:text-paper"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pills */}
      <div
        role="tablist"
        aria-label="Chat centre"
        className="flex gap-2 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === t.id
                ? "bg-accent text-accent-ink"
                : "text-paper/70 hover:text-paper"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="mt-5">
        {activeTab === "chat" && (
          <div>
            {/* Prefer WhatsApp? For visitors on the website rather than the app. */}
            <a
              href={contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 transition-colors hover:border-white/35"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
                <WhatsAppIcon width={22} height={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-paper">
                  Prefer WhatsApp?
                </span>
                <span className="block text-sm text-paper-dim">
                  Message us on WhatsApp instead
                </span>
              </span>
              <span className="ml-auto text-paper-dim">→</span>
            </a>

            {conversationId && (
              <div className="mt-4 h-[58vh]">
                <MemberChat
                  conversationId={conversationId}
                  initialMessages={initialMessages}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "notifications" && (
          <NotificationsList initial={notifications} />
        )}

        {activeTab === "requests" && <RescheduleRequests avail={avail} />}

        {activeTab === "onboarding" && (
          <OnboardingList
            initial={onboarding}
            onOpenChat={() => setTab("chat")}
          />
        )}
      </div>
    </div>
  );
}
