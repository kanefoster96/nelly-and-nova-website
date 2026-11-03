"use client";

import { Button } from "@/components/ui/Button";
import { useAuthStatus, useSession } from "@/lib/auth/session";
import { accountCard } from "./useAccount";

/** Loading, or "please log in", around the account pages. */
export function AccountGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const authStatus = useAuthStatus();
  if (authStatus === "loading") return <div className={`${accountCard} text-center text-paper-dim`}>Loading…</div>;
  if (!session) {
    return (
      <div className={`${accountCard} text-center`}>
        <h2 className="text-2xl font-semibold text-paper">Log in to view your account</h2>
        <p className="mt-2 text-sm text-paper-dim">Your details, your dogs and your password.</p>
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
