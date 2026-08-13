import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PracticeView } from "@/components/profile/PracticeLibrary";

export const metadata: Metadata = {
  title: "Practice",
  robots: { index: false, follow: false },
};

export default function PracticePage() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <Link
              href="/profile"
              className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent"
            >
              ← Back to profile
            </Link>
            <div className="mt-4">
              <PracticeView />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
