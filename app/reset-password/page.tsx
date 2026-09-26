import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-36">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <p className="text-sm uppercase tracking-widest text-paper-dim">Account</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">Set a new password</h1>
            <p className="mt-3 text-sm text-paper-dim">Choose a new password for your account.</p>
            <div className="mt-8">
              <ResetPasswordForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
