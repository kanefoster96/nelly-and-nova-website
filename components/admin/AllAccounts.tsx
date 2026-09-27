"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { listAccounts, type AccountWithDogs } from "@/lib/records/client";

/**
 * Every customer account from Supabase, each with quick links to its dogs.
 * While there are none yet (or the database isn't set up), `fallback` — the
 * sample member list — shows instead.
 */
export function AllAccounts({ fallback }: { fallback?: ReactNode }) {
  const [accounts, setAccounts] = useState<AccountWithDogs[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    listAccounts()
      .then((list) => setAccounts(list.filter((a) => a.role !== "admin")))
      .catch((e: Error) => {
        setError(e.message);
        setAccounts([]);
      });
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (accounts ?? []).filter(
      (a) => !q || [a.ownerName, a.email, a.phone, a.postcode, ...a.dogs.map((d) => d.name)].some((v) => v?.toLowerCase().includes(q))
    );
  }, [accounts, query]);

  if (accounts === null) return <p className="mt-8 text-paper-dim">Loading accounts…</p>;

  if (accounts.length === 0) {
    return (
      <div className="mt-8">
        <p className="rounded-lg border border-white/10 bg-ink-soft px-4 py-3 text-sm text-paper-dim">
          {error
            ? `${error} Showing sample members for now.`
            : "No customer accounts yet — they appear here as people sign up. Showing sample members for now."}
        </p>
        {fallback}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, email, phone, postcode or dog"
        className="w-full rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-paper-dim/70 outline-none focus:border-white/40"
      />
      <ul className="mt-5 space-y-2">
        {visible.map((a) => (
          <li key={a.id} className="rounded-2xl border border-white/10 bg-ink-soft">
            <Link href={`/admin/members/${a.id}`} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-paper">{a.ownerName || a.email || "Unnamed account"}</span>
                <span className="block truncate text-xs text-paper-dim">{[a.email, a.phone].filter(Boolean).join(" · ")}</span>
              </span>
              <ArrowRightIcon width={16} height={16} className="shrink-0 text-paper-dim" />
            </Link>
            {a.dogs.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-2.5">
                {a.dogs.map((d) => (
                  <Link
                    key={d.id}
                    href={`/admin/dogs/${d.id}`}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-ink py-1 pl-1 pr-3 text-xs text-paper transition-colors hover:border-white/35"
                  >
                    <span className="h-6 w-6 overflow-hidden rounded-full bg-white/10">
                      {d.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    {d.name}
                    {!d.waiverSignedAt && <span className="text-amber-300">·  form needed</span>}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {visible.length === 0 && <p className="mt-6 text-sm text-paper-dim">No accounts match.</p>}
    </div>
  );
}
