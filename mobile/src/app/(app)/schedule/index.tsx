import { useAuth } from "@/auth/AuthProvider";
import { MemberSchedule } from "@/components/schedule/MemberSchedule";
import { TrainerSchedule } from "@/components/schedule/TrainerSchedule";

export default function Schedule() {
  const { isTrainer } = useAuth();
  return isTrainer ? <TrainerSchedule /> : <MemberSchedule />;
}
