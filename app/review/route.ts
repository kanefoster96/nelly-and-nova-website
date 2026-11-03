import { NextResponse } from "next/server";
import { getWriteReviewUrl } from "@/lib/reviews/google";

/**
 * nellyandnova.co.uk/review → Google's "write a review" box.
 * A short, stable link to put in report cards, emails, texts or a QR code;
 * where it lands can change in lib/reviews/google.ts without reprinting it.
 */
export async function GET() {
  return NextResponse.redirect(await getWriteReviewUrl());
}
