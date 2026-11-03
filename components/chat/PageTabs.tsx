"use client";

import { useState, type ReactNode } from "react";

export type PageTab = {
  key: string;
  label: string;
  /** Unread/pending count on the pill — 0 or missing shows no badge. */
  count?: number;
};

// Badge colour by meaning: blue for messages, green for notifications,
// amber for anything waiting on a decision.
const BADGE_COLOR_BY_KEY: Record<string, string> = {
  chat: "bg-[#0a84ff]",
  notifications: "bg-emerald-500",
  requests: "bg-amber-500",
};

/**
 * Pills (Live Chat / Notifications / …) switching between panels, ported
 * from Kanvas Academy. Every panel stays mounted — only hidden — so switching
 * tabs never drops the chat's live connection or a half-typed message.
 */
export function PageTabs({
  tabs,
  panels,
  defaultTab,
  railClassName = "",
}: {
  tabs: PageTab[];
  panels: Record<string, ReactNode>;
  defaultTab?: string;
  railClassName?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`glass flex items-center gap-1 rounded-full p-1 hover:bg-white/[0.08] ${railClassName}`}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            aria-pressed={active === tab.key}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
              active === tab.key ? "bg-accent text-accent-ink" : "text-paper/70 hover:text-paper"
            }`}
          >
            {tab.label}
            {!!tab.count && (
              <span
                className={`flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${
                  BADGE_COLOR_BY_KEY[tab.key] ?? "bg-amber-500"
                }`}
              >
                {tab.count > 99 ? "99+" : tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div key={tab.key} className={`mt-3 flex min-h-0 flex-1 flex-col ${active === tab.key ? "" : "hidden"}`}>
          {panels[tab.key]}
        </div>
      ))}
    </div>
  );
}
