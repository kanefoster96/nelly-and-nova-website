import { createClient } from "@/lib/supabase/server";

export type PendingReschedule = {
  id: string;
  accountId: string;
  ownerName: string;
  dogName: string;
  sessionId: string;
  scheduledAt: string;
  kind: string;
  location: string;
  preferredDate: string | null;
  reason: string | null;
  createdAt: string;
};

type SessionRow = {
  id: string;
  account_id: string;
  scheduled_at: string;
  kind: string;
  location: string | null;
  dogs: { name: string } | { name: string }[] | null;
  profiles: { owner_name: string | null } | { owner_name: string | null }[] | null;
};

type Row = {
  id: string;
  preferred_date: string | null;
  reason: string | null;
  created_at: string;
  session: SessionRow | SessionRow[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function getPendingReschedules(): Promise<PendingReschedule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reschedule_requests")
    .select(
      "id, preferred_date, reason, created_at, session:training_sessions(id, account_id, scheduled_at, kind, location, dogs(name), profiles(owner_name))"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return ((data ?? []) as unknown as Row[])
    .map((r) => ({ ...r, session: one(r.session) }))
    .filter((r): r is Row & { session: SessionRow } => r.session !== null)
    .map((r) => {
      const session = r.session;
      return {
        id: r.id,
        accountId: session.account_id,
        ownerName: one(session.profiles)?.owner_name || "Member",
        dogName: one(session.dogs)?.name || "Dog",
        sessionId: session.id,
        scheduledAt: session.scheduled_at,
        kind: session.kind,
        location: session.location ?? "",
        preferredDate: r.preferred_date,
        reason: r.reason,
        createdAt: r.created_at,
      };
    });
}
