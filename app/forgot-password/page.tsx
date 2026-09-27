import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot your password?",
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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-paper sm:text-4xl">Forgot your password?</h1>
            <p className="mt-3 text-sm text-paper-dim">Enter the email you log in with and we&apos;ll send you a link to set a new password.</p>
            <div className="mt-8">
              <ForgotPasswordForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
