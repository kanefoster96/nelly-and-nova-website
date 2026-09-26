import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { ContactDetail, type ContactDog } from "@/components/admin/ContactDetail";
import { getWeekSchedule } from "@/lib/schedule/data";
import { AccountDetail } from "@/components/admin/AccountDetail";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: "Contact",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // A real customer account (Supabase user id).
  if (UUID_RE.test(id)) {
    return (
      <>
        <Nav />
        <main id="main" className="flex-1">
          <section className="bg-ink pb-24 pt-28 sm:pt-32">
            <div className="mx-auto max-w-2xl px-4 sm:px-6">
              <Link href="/admin/members" className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent">
                ← Back to members
              </Link>
              <RequireAdmin>
                <AccountDetail accountId={id} />
              </RequireAdmin>
            </div>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  // Otherwise a sample-roster member (scheduling scaffold).
  const week = await getWeekSchedule();

  // Find the clicked dog and the owner, then gather all of that owner's dogs.
  let ownerName: string | null = null;
  for (const d of week) {
    const dog = d.dogs.find((x) => x.id === id);
    if (dog) {
      ownerName = dog.ownerName;
      break;
    }
  }
  if (!ownerName) notFound();

  const dogs: ContactDog[] = [];
  for (const d of week) {
    for (const dog of d.dogs) {
      if (dog.ownerName === ownerName) dogs.push({ ...dog, day: d.day });
    }
  }
  const email = dogs.find((x) => x.email)?.email;
  const todayISO = new Date().toISOString();

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <Link
              href="/admin/members"
              className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent"
            >
              ← Back to members
            </Link>
            <RequireAdmin>
              <ContactDetail
                primaryId={id}
                ownerName={ownerName}
                email={email}
                dogs={dogs}
                week={week}
                todayISO={todayISO}
              />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
