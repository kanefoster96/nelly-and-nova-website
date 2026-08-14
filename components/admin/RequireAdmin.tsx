"use client";

import { Button } from "@/components/ui/Button";
import { useSession, useAuthStatus } from "@/lib/auth/session";

/**
 * Gate admin pages to signed-in trainers. The client-side gate is a UX guard;
 * the real protection is Row Level Security (is_admin()) on every table.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const authStatus = useAuthStatus();

  if (authStatus === "loading") {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <p className="text-paper-dim">Loading…</p>
      </div>
    );
  }

  if (!session || session.role !== "admin") {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <h2 className="display-heading text-2xl text-paper">Trainers only</h2>
        <p className="mx-auto mt-3 max-w-sm text-paper/75">
          Log in as a trainer to view this.
        </p>
        <div className="mt-6 flex justify-center">
          <Button href="/login" radius="xl">
            Log in
          </Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
