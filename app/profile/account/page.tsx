import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AccountInfo } from "@/components/AccountInfo";

export const metadata: Metadata = {
  title: "Account holder information",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
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
            <h1 className="display-heading mt-4 text-3xl text-paper sm:text-4xl">
              Account holder.
            </h1>
            <p className="mt-3 text-paper/75">
              Your own details and password. Your dog stays the main profile.
            </p>
            <div className="mt-8">
              <AccountInfo />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
