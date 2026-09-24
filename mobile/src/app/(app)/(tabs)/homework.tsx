import { useAuth } from "@/auth/AuthProvider";
import { MemberHomework } from "@/components/homework/member-homework";
import { TrainerLibrary } from "@/components/homework/trainer-library";

export default function Homework() {
  const { isTrainer } = useAuth();
  return isTrainer ? <TrainerLibrary /> : <MemberHomework />;
}
