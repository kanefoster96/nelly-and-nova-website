import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { DogRecordView } from "@/components/dogs/DogRecordView";

export const metadata: Metadata = {
  title: "Your dog",
  robots: { index: false, follow: false },
};

export default async function DogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-xl px-4 sm:px-6">
            <Link href="/profile/account" className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent">
              ← Back to your account
            </Link>
            <div className="mt-6">
              <DogRecordView dogId={id} mode="owner" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
