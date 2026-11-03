# Nelly & Nova — to do

Last updated 3 November 2026. Tick things off as they're done.

## For you to do

- [ ] **Google reviews: create an API key** (about 10 min, on a computer)
  - If the Credentials page keeps reloading: use **Chrome in an incognito
    window**, signed in with **only** the Nelly & Nova Google account. Or try
    console.cloud.google.com/google/maps-apis/credentials
  - Project "Nelly & Nova website" → **APIs & Services → Library** → enable
    **Places API (New)** (needs billing; costs pennies at most)
  - **Credentials → Create credentials → API key** → restrict it to
    **Places API (New)** only
  - Send the key to Claude: it goes on Vercel and the real reviews appear
- [ ] **Check Nelly & Nova is on Google Maps.** If not, create a free Google
      Business Profile at business.google.com (needed for reviews at all)
- [ ] **Email: verify the domain in Resend**
  - resend.com → **Domains → Add Domain** → `nellyandnova.co.uk`, region
    Ireland (eu-west-1)
  - Add the records it shows in **Wix → Domains → Manage DNS records**
  - Click **Verify** in Resend, then tell Claude to switch the "from"
    address to `hello@nellyandnova.co.uk` (customer confirmation emails
    only start working after this)
- [ ] **Sign-up emails (Supabase → Authentication)** — 5 minutes
  - **Sign In / Providers → Email**: is **Confirm email** on? If it is,
    customers only get the confirmation link once a real email sender is
    set: Supabase's own one only emails your team. Either turn it **off**
    for now (accounts work straight away), or do the next step
  - **Emails → SMTP Settings** (after the Resend domain is verified): host
    `smtp.resend.com`, port `465`, username `resend`, password = the Resend
    API key, sender `hello@nellyandnova.co.uk`, name `Nelly & Nova`
  - **URL Configuration → Redirect URLs**: add
    `https://nelly-and-nova-website.vercel.app/auth/confirm` (and the
    nellyandnova.co.uk one once the domain moves)
- [ ] **Test the contact form** on nelly-and-nova-website.vercel.app/contact
      and check the email reaches charlotte@nellyandnova.co.uk (check spam)
- [ ] **Real photos** for the homepage cards and How it works (they reuse
      existing photos for now — paths in `config/media.ts`)
- [ ] **Moving the domain from Wix** (when everything else is ready): copy
      the Resend DNS records to the new host so email keeps working

## Ask Claude to do (needs your go-ahead)

- [ ] **Put today's work live**: open a pull request for the
      `claude/awesome-pasteur-m8jeyo` branch and merge it. The live site is
      still the older version (no live chat, old homepage, old contact page)
- [ ] **Run the customer-records database update**
      (`supabase/migrations/20260926000000_customer_records.sql`). It was
      never run on the live database, so dog documents, waivers, enquiries
      and address details don't save yet
- [ ] **Send the app update** with the new live chat (over the air, no app
      store review needed)
- [ ] **Hide the sample reviews** if the site goes live before Google
      reviews are connected (they're made up)
- [ ] Decide: **glass buttons across the whole site**, not just the chat
      screens?
- [ ] Decide: **blur on the app's glass buttons** (needs a new app build
      through the app stores)

## Still sample data (built when needed)

- Notifications and requests in the inbox and on /messages
- Reschedule requests, onboarding list on /messages, schedule

## Done 3 November

- Live chat on the website and app, copied from Kanvas Academy (database set
  up and tested)
- Homepage: photo cards, section titles hidden, Leave when you're ready and
  the reviews avatar carousel removed, "Life Skills" added to the marquee,
  photos behind How it works
- Walk & Train renamed Full Day Training (old link redirects)
- FAQ about training tools
- Contact page in the Kanvas layout; phone and WhatsApp 0191 468 3251
- Resend connected on Vercel (sending from Resend's test address for now)
- Google reviews and the /review link built, waiting for the API key
