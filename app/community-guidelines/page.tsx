import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { communityGuidelines } from "@/config/communityGuidelines";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description: "How we keep the Nelly & Nova community friendly and safe.",
};

export default function CommunityGuidelinesPage() {
  return <LegalPage doc={communityGuidelines} />;
}
