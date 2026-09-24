import { useAuth } from "@/auth/AuthProvider";
import { MemberHomework } from "@/components/homework/MemberHomework";
import { TrainerLibrary } from "@/components/homework/TrainerLibrary";

export default function Homework() {
  const { isTrainer } = useAuth();
  return isTrainer ? <TrainerLibrary /> : <MemberHomework />;
}
