# Nelly & Nova — to-do list

Things still to finish on the site and app. Tick them off as they're done.

## Go-live setup (you)

- [ ] **Supabase:** run `supabase/migrations/20260926000000_customer_records.sql` (see `docs/SUPABASE_SETUP.md`)
- [ ] **Supabase:** set the Site URL and add `/reset-password` to the redirect URLs
- [ ] **Domain:** connect www.nellyandnova.co.uk to Vercel
- [ ] **Vercel:** set `NEXT_PUBLIC_SITE_URL=https://www.nellyandnova.co.uk` (used for the logo in emails)
- [ ] **Resend:** create an account, verify the domain, and add `RESEND_API_KEY` in Vercel
- [ ] **Test end to end once live:** meet & greet → account → dog registration → forgot password

## To build

- [ ] **Google reviews:** swap the placeholder reviews for the real Google feed
  - Needs: the business's Google `place_id` and a Places API key (`GOOGLE_MAPS_API_KEY`)
  - Code: fetch Places Details (`reviews`) and pass the results to `<Reviews items={...} />`; see `config/site.ts` for the mapping
- [ ] **GoCardless payments:** connect the real API (the payment code is a stand-in for now; see `lib/payments/data.ts`)
- [ ] **Contact enquiry email:** a designed email to match the others
- [ ] **Supabase login emails:** branded black & white templates for sign-up confirmation and password reset
- [ ] **Real photos:** replace the placeholder photos and avatars (see "Swapping in real media" in `README.md`)

## App

- [ ] Apple Developer account ready
- [ ] Choose the bundle ID for TestFlight
- [ ] First TestFlight build, then publish over-the-air updates with `eas update`
