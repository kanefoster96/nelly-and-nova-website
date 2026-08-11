import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { privacy } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Nelly & Nova collects, uses and protects your personal information.",
};

export default function PrivacyPage() {
  return <LegalPage doc={privacy} />;
}
