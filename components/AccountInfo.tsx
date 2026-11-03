"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import { ArrowRightIcon } from "./ui/Icons";
import { signOut } from "@/lib/auth/session";
import { AccountGate } from "./account/AccountGate";
import { accountCard, useAccount } from "./account/useAccount";

const pill =
  "rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-paper transition-colors hover:border-white/40 active:bg-white/10";

/**
 * The account, laid out like Kanvas's: a summary card (photo, name, email
 * and the things you can do — edit, password, your data, delete), then your
 * dogs, then log out. Editing and the password each have their own page.
 */
function Account() {
  const router = useRouter();
  const { profile, dogs, error } = useAccount();
  const name = profile?.ownerName || "Your account";

  function logout() {
    void signOut();
    router.push("/");
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className={accountCard}>
        <div className="flex items-center gap-4">
          {profile?.avatarUrl ? (
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl font-medium text-paper">
              {(profile?.ownerName || profile?.email || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-paper">{profile ? name : "Loading…"}</p>
            <p className="truncate text-sm text-paper-dim">{profile?.email}</p>
            {profile?.phone && <p className="truncate text-sm text-paper-dim">{profile.phone}</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/profile/account/edit" className={pill}>
            Edit Details
          </Link>
          <Link href="/profile/account/password" className={pill}>
            Change Password
          </Link>
          <Link href="/account/your-data" className={pill}>
            Your Data
          </Link>
          <Link
            href="/account/delete"
            className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-paper-dim transition-colors hover:border-red-400/40 hover:text-red-300 active:bg-red-500/10"
          >
            Delete Account
          </Link>
        </div>
      </div>

      {/* Your dogs — each dog's record */}
      <div className={accountCard}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-paper">Your dogs</h2>
          <Link href="/profile/dogs/new" className="text-sm text-paper-dim underline underline-offset-2 hover:text-paper">
            + Add a dog
          </Link>
        </div>
        {dogs === null && !error ? (
          <p className="mt-4 text-sm text-paper-dim">Loading…</p>
        ) : dogs && dogs.length === 0 ? (
          <p className="mt-4 text-sm text-paper-dim">No dogs on your account yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
            {(dogs ?? []).map((d) => (
              <li key={d.id}>
                <Link href={`/profile/dogs/${d.id}`} className="flex items-center gap-3 bg-ink px-4 py-3 transition-colors hover:bg-white/[0.04]">
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
                    {d.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-paper">{d.name}</span>
                    <span className="block truncate text-xs text-paper-dim">
                      {[d.breed, d.waiverSignedAt ? "Consent form signed" : "Consent form needed"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ArrowRightIcon width={16} height={16} className="shrink-0 text-paper-dim" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" radius="xl" onClick={logout}>
          Log out
        </Button>
      </div>
    </div>
  );
}

export function AccountInfo() {
  return (
    <AccountGate>
      <Account />
    </AccountGate>
  );
}
