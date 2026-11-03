import { redirect } from "next/navigation";

/**
 * Notifications and chat lines point at the app's /requests (and
 * /requests/<id>). On the website that's the trainers' Session requests page.
 */
export default function RequestsRedirect() {
  redirect("/admin/requests");
}
