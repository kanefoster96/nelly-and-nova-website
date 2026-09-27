"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { listAllDogs, type DogWithOwner } from "@/lib/records/client";
import { ageFromDob } from "@/lib/records/types";

type Filter = "all" | "unsigned" | "signed";

/**
 * Every dog on the books, from Supabase: search by dog, owner or breed, filter
 * by consent-form status, and open a dog's full record. While the database has
 * no dogs yet (or isn't set up), `fallback` — the sample roster — shows instead.
 */
export function AllDogs({ fallback }: { fallback?: ReactNode }) {
  const [dogs, setDogs] = useState<DogWithOwner[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    listAllDogs()
      .then(setDogs)
      .catch((e: Error) => {
        setError(e.message);
        setDogs([]);
      });
  }, []);

  const visible = useMemo(() => {
    if (!dogs) return [];
    const q = query.trim().toLowerCase();
    return dogs.filter((d) => {
      if (filter === "signed" && !d.waiverSignedAt) return false;
      if (filter === "unsigned" && d.waiverSignedAt) return false;
      if (!q) return true;
      return [d.name, d.breed, d.owner?.ownerName, d.owner?.email, d.microchip].some((v) => v?.toLowerCase().includes(q));
    });
  }, [dogs, query, filter]);

  if (dogs === null) return <p className="mt-8 text-paper-dim">Loading dogs…</p>;

  if (dogs.length === 0) {
    return (
      <div className="mt-8">
        <p className="rounded-lg border border-white/10 bg-ink-soft px-4 py-3 text-sm text-paper-dim">
          {error
            ? `${error} Showing the sample roster for now.`
            : "No dogs have been registered yet — they appear here as customers create accounts. Showing the sample roster for now."}
        </p>
        {fallback}
      </div>
    );
  }

  const unsigned = dogs.filter((d) => !d.waiverSignedAt).length;

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dog, owner, breed or microchip"
          className="w-full flex-1 rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-paper-dim/70 outline-none focus:border-white/40"
        />
        <div className="flex gap-2">
          {(
            [
              ["all", `All (${dogs.length})`],
              ["unsigned", `Form needed (${unsigned})`],
              ["signed", "Signed"],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === k ? "border-accent bg-accent text-accent-ink" : "border-white/15 text-paper-dim hover:border-white/35"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-paper-dim">No dogs match.</p>
      ) : (
        <ul className="mt-5 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
          {visible.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/dogs/${d.id}`} className="flex items-center gap-3 bg-ink-soft px-4 py-3 transition-colors hover:bg-white/[0.04]">
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/10">
                  {d.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-paper">{d.name}</span>
                  <span className="block truncate text-xs text-paper-dim">
                    {[d.breed, ageFromDob(d.dateOfBirth), d.owner?.ownerName].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    d.waiverSignedAt ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {d.waiverSignedAt ? "Form signed" : "Form needed"}
                </span>
                <ArrowRightIcon width={16} height={16} className="shrink-0 text-paper-dim" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
