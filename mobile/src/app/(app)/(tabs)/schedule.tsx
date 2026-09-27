import { useAuth } from "@/auth/AuthProvider";
import { MemberSchedule } from "@/components/schedule/member-schedule";
import { TrainerSchedule } from "@/components/schedule/trainer-schedule";

export default function Schedule() {
  const { isTrainer } = useAuth();
  return isTrainer ? <TrainerSchedule /> : <MemberSchedule />;
}
