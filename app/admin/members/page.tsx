import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { MembersList, type Member } from "@/components/admin/MembersList";
import { getWeekSchedule } from "@/lib/schedule/data";

export const metadata: Metadata = {
  title: "Members",
  robots: { index: false, follow: false },
};

export default async function MembersPage() {
  const week = await getWeekSchedule();
  // One member per dog owner (deduped by owner name).
  const seen = new Set<string>();
  const members: Member[] = [];
  for (const day of week) {
    for (const dog of day.dogs) {
      if (seen.has(dog.ownerName)) continue;
      seen.add(dog.ownerName);
      members.push({
        id: dog.id,
        name: dog.ownerName,
        dogName: dog.name,
        photo: dog.photo,
      });
    }
  }

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <Link
              href="/admin"
              className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent"
            >
              ← Back to dashboard
            </Link>
            <h1 className="display-heading mt-4 text-3xl text-paper sm:text-4xl">
              Members
            </h1>
            <p className="mt-3 text-paper/75">
              Manage member accounts. Cancelling releases their schedule slot.
            </p>

            <RequireAdmin>
              <MembersList members={members} />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
