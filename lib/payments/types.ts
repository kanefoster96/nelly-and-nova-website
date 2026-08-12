/**
 * Per-session payment status. A recurring session is charged via GoCardless;
 * the charge is paid, still pending, or failed (mandate/funds issue). A failed
 * charge triggers an automated email so the customer can resubmit.
 */
export type PaymentStatus = "paid" | "pending" | "failed";

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  paid: "Paid",
  pending: "Unpaid",
  failed: "Failed",
};
