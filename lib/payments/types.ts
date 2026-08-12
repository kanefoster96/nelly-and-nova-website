/**
 * Per-session payment status. A recurring session is charged via GoCardless;
 * the charge is paid, still pending, or failed (mandate/funds issue). A failed
 * charge triggers an automated email so the customer can resubmit. Staff can
 * also refund a collected payment or cancel one that hasn't been taken yet
 * (see the payments management page).
 */
export type PaymentStatus = "paid" | "pending" | "failed" | "refunded" | "cancelled";

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  paid: "Paid",
  pending: "Unpaid",
  failed: "Failed",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

/** Statuses that are settled — no "chase" action applies. */
export const TERMINAL_STATUSES: PaymentStatus[] = ["paid", "refunded", "cancelled"];
