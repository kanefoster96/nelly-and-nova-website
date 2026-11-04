import { Redirect } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { MemberSchedule } from "@/components/schedule/member-schedule";

/** Owners: their sessions. Trainers have Today and the Calendar instead (a link here goes to Today). */
export default function Schedule() {
  const { isTrainer } = useAuth();
  if (isTrainer) return <Redirect href="/today" />;
  return <MemberSchedule />;
}
