import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { DogRecordView } from "@/components/dogs/DogRecordView";

export const metadata: Metadata = {
  title: "Dog",
  robots: { index: false, follow: false },
};

export default async function AdminDogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-xl px-4 sm:px-6">
            <Link href="/admin/dogs" className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent">
              ← All dogs
            </Link>
            <div className="mt-6">
              <RequireAdmin>
                <DogRecordView dogId={id} mode="trainer" />
              </RequireAdmin>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
