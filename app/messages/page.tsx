import type { Metadata } from "next";
import { MessagesApp } from "@/components/chat/MessagesApp";
import { getNotifications, getOnboarding } from "@/lib/inbox/data";
import { getWeekSchedule } from "@/lib/schedule/data";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

/**
 * Live chat with the team (see components/chat/MessagesApp.tsx). The chat
 * itself loads in the browser from Supabase; notifications, onboarding and
 * the week's schedule still come from the scaffold data here.
 */
export default async function MessagesPage() {
  const [notifications, onboarding, week] = await Promise.all([
    getNotifications(),
    getOnboarding(),
    getWeekSchedule(),
  ]);
  return <MessagesApp notifications={notifications} onboarding={onboarding} week={week} />;
}
