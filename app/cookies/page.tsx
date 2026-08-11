import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { cookies } from "@/config/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How the Nelly & Nova website uses cookies and similar technologies, and how to manage them.",
};

export default function CookiesPage() {
  return <LegalPage doc={cookies} />;
}
