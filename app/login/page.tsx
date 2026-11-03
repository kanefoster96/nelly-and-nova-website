import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Arriving from a used or expired "confirm your email" link.
  const confirmFailed = (await searchParams).confirm === "failed";

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-36">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Welcome back
            </p>
            <h1 className="display-heading text-4xl text-paper sm:text-5xl">
              Log in.
            </h1>
            <p className="mt-6 text-paper/80">
              Log in to see your dog&apos;s profile, track their training and
              chat with us directly.
            </p>

            {confirmFailed && (
              <p className="mt-6 rounded-xl bg-white/[0.06] px-4 py-3 text-sm text-paper/85 ring-1 ring-white/10">
                That confirmation link has already been used or has expired. If you&apos;ve
                confirmed already, just log in below.
              </p>
            )}

            <div className="mt-8">
              <LoginForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
