import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { DogsList, type DogRow } from "@/components/admin/DogsList";
import { getWeekSchedule } from "@/lib/schedule/data";
import { dayLabel } from "@/lib/schedule/types";

export const metadata: Metadata = {
  title: "All dogs",
  robots: { index: false, follow: false },
};

export default async function DogsPage() {
  const week = await getWeekSchedule();
  // One row per dog, with the day they train.
  const dogs: DogRow[] = week.flatMap((d) =>
    d.dogs.map((dog) => ({
      id: dog.id,
      name: dog.name,
      owner: dog.ownerName,
      photo: dog.photo,
      day: dayLabel(d.day),
    }))
  );

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
              All dogs
            </h1>
            <p className="mt-3 text-paper/75">
              Every dog on the books. Edit a dog to update their details.
            </p>

            <RequireAdmin>
              <DogsList dogs={dogs} />
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
