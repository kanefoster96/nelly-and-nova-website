import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { terms } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms and conditions for using the Nelly & Nova website and dog training services.",
};

export default function TermsPage() {
  return <LegalPage doc={terms} />;
}
