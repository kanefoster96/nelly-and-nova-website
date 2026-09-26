import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AddDogForm } from "@/components/dogs/AddDogForm";

export const metadata: Metadata = {
  title: "Add a dog",
  robots: { index: false, follow: false },
};

export default function NewDogPage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <Link href="/profile/account" className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent">
              ← Back to your account
            </Link>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-paper">Add a dog</h1>
            <div className="mt-8">
              <AddDogForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
