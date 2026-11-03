import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { AccountInfo } from "@/components/AccountInfo";

export const metadata: Metadata = {
  title: "Your account",
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
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Account</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">Manage your account</h1>
            <div className="mt-8">
              <AccountInfo />
            </div>
            <p className="mt-8 text-center text-sm text-paper-dim">
              <Link href="/community-guidelines" className="underline underline-offset-2 hover:text-paper">
                Community Guidelines
              </Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
