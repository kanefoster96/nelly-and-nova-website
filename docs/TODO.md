# Nelly & Nova — to do

Last updated 18 November 2026. Tick things off as they're done.

## 1. Blocking real customers (do these first)

- [ ] **Run the database update.** None of the 4 November changes are on the
      live database yet: pick-up runs, attendance, dog records privacy,
      homework days and videos, day photos, chat cards and meet & greet
      bookings. Either say "go" and Claude applies it, or run the combined
      SQL file Claude gives you in Supabase → SQL Editor. It must say
      "Done: all 7 changes in place".
- [ ] **Verify the email domain in Resend.** Until then, emails (app log-in
      links, confirmations, reminders) only reach charlotte@nellyandnova.co.uk.
  - Sign in to the **Nelly & Nova** Resend account → **Domains → Add Domain**
    → `nellyandnova.co.uk`, region Ireland (eu-west-1)
  - Add the records it shows in **Wix → Domains → Manage DNS records**
  - Click **Verify**, then tell Claude to change `CONTACT_FROM_EMAIL` on
    Vercel to `Nelly & Nova <hello@nellyandnova.co.uk>`
- [ ] **Supabase sign-up emails** (after the Resend domain is verified)
  - Authentication → **Emails → SMTP Settings**: host `smtp.resend.com`,
    port `465`, username `resend`, password = the Resend API key, sender
    `hello@nellyandnova.co.uk`, name `Nelly & Nova`
  - Authentication → **URL Configuration → Redirect URLs**: add
    `https://nelly-and-nova-website.vercel.app/auth/confirm`, and the
    nellyandnova.co.uk one once the domain moves
- [ ] **GoCardless webhook**, so Direct Debits and payments update by
      themselves: GoCardless → Developers → Create → **Webhook endpoint** →
      URL `https://nelly-and-nova-website.vercel.app/api/webhooks/gocardless`
      → copy the secret → add on Vercel as `GOCARDLESS_WEBHOOK_SECRET`
      (Production, Sensitive) → tell Claude to redeploy
- [ ] **Publish the latest app update.** Claude does it once the database
      update is in: it's ready on the branch, waiting to be merged.

## 2. Vercel settings

Already set: Supabase (URL, public key, secret key), Resend key, where
enquiries go, the "from" address (test sender for now), GoCardless (token,
live mode, relay secret), the cron secret.

| Setting | Status | What it does |
|---|---|---|
| `GOCARDLESS_WEBHOOK_SECRET` | **Missing** | Direct Debit and payment statuses update by themselves |
| `APPLE_TEAM_ID` | **Missing** | Email links open the app instead of the website (developer.apple.com → Membership details) |
| `GOOGLE_PLACES_API_KEY` | **Missing** | Real Google reviews on the homepage, and the "Leave a review" button |
| `CONTACT_FROM_EMAIL` | Change later | Switch to `Nelly & Nova <hello@nellyandnova.co.uk>` once Resend is verified |
| `NEXT_PUBLIC_SITE_URL` | Later | `https://www.nellyandnova.co.uk` once the domain points to Vercel |
| `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional | Map previews in admin |

## 3. Domain (when everything above works)

- [ ] **Point nellyandnova.co.uk at Vercel.** It's on Wix now, and the
      Vercel project only has `nelly-and-nova-website.vercel.app`.
  - Vercel → Project → Settings → **Domains** → add `nellyandnova.co.uk`
    and `www.nellyandnova.co.uk`
  - In Wix DNS, set the records Vercel shows. Keep the Resend records and
    your email (MX) records as they are.
  - Then: set `NEXT_PUBLIC_SITE_URL`, add the new address to Supabase's
    Redirect URLs, and update the GoCardless webhook URL
  - The app already expects `nellyandnova.co.uk` for links opening in the app

## 4. App Store

- [ ] **Add yourself as a TestFlight tester** (App Store Connect → TestFlight
      → Internal Testing → the group → Testers)
- [ ] **TestFlight public link** (optional): TestFlight → External Testing →
      a group → Public Link → send to Claude for the `/app` page and the
      Invite to the app QR code
- [ ] **App Store release**: screenshots, description, privacy details,
      then submit. Afterwards send Claude the App Store link (`appStoreUrl`)
- [ ] **Next native build** (Claude asks first): photo resizing before upload
      (smaller files, like Instagram) and Google Maps as a directions option

## 5. Content and checks

- [ ] **Google Business Profile**: make sure Nelly & Nova is on Google Maps
      (needed for reviews)
- [ ] **Test the contact form and the request form**, and check the email
      arrives (check spam)
- [ ] **Real photos** for the homepage cards and How it works
      (`config/media.ts`)
- [ ] **Hide the sample reviews** if the site goes live before Google
      reviews are connected
- [ ] **Before early 2027: swap the Supabase public key** for the
      `sb_publishable_…` one (Vercel and the app). Claude can do it.

## Still sample data on the website

- The admin weekly schedule board, payments board, holidays and add
  customer pages (the app's versions use real data)

## Done

- **3 Nov:** live chat; homepage, contact and booking pages; Resend
  connected; Google reviews built (waiting for the key); GoCardless
  onboarding; first TestFlight build
- **4 Nov:**
  - app Profile tab; session requests and payments; report cards
  - Today tab with pick-up runs; onboarding, registration and My Info in
    the app; Homework tab
  - borderless website; Supabase secret key added
  - over-the-air updates from Expo
- **Since (on the branch, not live yet):** bookings for customers, Today as
  the register, Week tab, Write today's reports, Invite to the app QR,
  welcome screens, day updates and photos, chat cards and quick replies
