import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ProfileView } from "@/components/ProfileView";
import { getDogProfile } from "@/lib/reports/data";

export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const profile = await getDogProfile();
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <ProfileView profile={profile} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
