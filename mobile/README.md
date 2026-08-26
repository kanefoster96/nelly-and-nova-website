# Nelly & Nova — App

Native mobile app (iOS + Android) for Nelly & Nova, built with
[Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router/introduction).
It shares its backend with the [website](../README.md) — the same Supabase
project handles auth, dog profiles, sessions, holidays and everything else,
so an account created on one works on the other.

This is **not** a wrapped website — it's a real React Native app, built
screen by screen to match the website's features (login, dog profiles,
session dates, reports, chat, etc.).

Members only — there's no public/marketing content in the app. On sign-in,
the account's role decides what they see: `profiles.role === "admin"` gets
the admin app, everyone else gets the customer app (see **Auth & routing**
below).

## Stack

- **Expo (SDK 57)** + **Expo Router** (file-based routing) + **TypeScript**
- **React Native**
- **Supabase** (`@supabase/supabase-js`) — same project as the website, incl. Storage

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the Supabase URL + anon key
npm run start           # opens Expo dev tools — scan the QR with Expo Go,
                         # or press i / a for a simulator/emulator
```

Other scripts:

```bash
npm run ios         # iOS simulator (macOS only)
npm run android     # Android emulator
npm run web         # run in a browser (handy for quick UI iteration)
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
```

## Shipping to TestFlight (EAS Build)

Same setup/workflow as the Kanvas Academy app — `eas.json` here mirrors its
build profiles exactly. One-time setup, then it's the usual `eas build` /
`eas submit` from your terminal:

```bash
npx eas login     # once per machine — your Expo account (kanefoster96)
npx eas init       # once per app — links this project to an EAS project,
                    # writes extra.eas.projectId into app.json.
```

Then, same two commands every release:

```bash
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production --latest   # uploads to TestFlight
```

(`--latest` submits the build that just finished, without rebuilding — drop
it and `eas submit` will offer a picker instead.) First submit will prompt
for your Apple ID / App Store Connect access if EAS doesn't already have it
cached from Kanvas Academy — it can reuse the same Apple Developer account
if this app is under the same team, otherwise it'll ask which team to use.

`eas.json`'s `production` profile has `autoIncrement: true` and
`appVersionSource: "remote"`, so EAS manages the build number for you —
there's nothing to hand-edit in `app.json` between releases, just bump
`expo.version` when you actually want a new marketing version (1.0.1, etc).

`preview` and `development` profiles are there too (internal-distribution
builds — an ad-hoc/simulator build to test without going through
TestFlight, and a dev-client build for local native-module development)
but production → TestFlight is the one you'll use most.

## Environment

Copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_SUPABASE_URL` — same value as the website's `NEXT_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same value as the website's `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Expo automatically inlines any `EXPO_PUBLIC_*` variable into the JS bundle,
so no extra config is needed. Without a `.env`, the app still renders (a
console warning is logged) but every Supabase call fails, which
`lib/session.ts` treats as signed-out.

## Auth & routing

`src/app/index.tsx` is the entry point and the only place that decides where
a signed-in account lands — every screen reads the *same* live Supabase
session via `lib/session.ts` (same `profiles` + `dogs` tables the website's
`lib/auth/session.ts` reads), so there's no separate/duplicated auth state:

| Condition | Destination |
| --- | --- |
| Signed out | `/login` |
| `profiles.role === "admin"` | `/admin` (placeholder for now) |
| Member with a dog on the account | `/customer` (the customer app) |
| Member with no dog yet | `/pending` ("not set up yet") |

There's no dedicated "membership status" column in the database yet — a dog
only gets created on an account once a membership is set up (see the
website's onboarding flow) — so "has a dog" is the closest real signal
available for "has an active membership". See `hasActiveMembership()` in
`lib/session.ts`. Swap that for a real `profiles.membership_status` (or
similar) field once one exists.

## The customer app (`src/app/customer/`)

Onboarding happens on the website; once someone's membership is set up
there, they're sent to sign into the app. So the app itself skips
onboarding entirely and gets straight to five tabs, kept deliberately
simple for a first working version:

- **Top bar** (`components/TopBar.tsx`) — account avatar top-left (opens
  Your Dog, see below), app name centred, a chat icon and a notifications
  bell top-right (both real — see **Chat & notifications** below).
- **Bottom tabs** (`customer/(tabs)/_layout.tsx`) — **Home, Your Dog, Next
  Session, Calendar, Homework**.

`customer/` is a Stack (`customer/_layout.tsx`, holds the auth/membership
guard) with just the `(tabs)` group registered as its only child — every
customer-facing screen right now is one of the five tabs, so there's
nothing else in the Stack to route to.

**Layout rule for every screen in the app:** nothing sits inside a padded
"container" unless it's a genuinely intentional card (a notice, a comment
bubble, the composer, a form). Feed content, images and list-style content
run edge-to-edge like Instagram/Facebook — screens/lists carry no horizontal
padding themselves; individual rows (text, avatars, buttons) add their own.
See `customer/index.tsx` / `components/community/PostCard.tsx` for the
reference implementation (media has zero inset; text/actions do).

### 1. Home = the community feed

Home (`customer/(tabs)/index.tsx`) is a live Facebook-wall-style feed —
`lib/community.ts` reads/writes the real `posts`, `post_media`, `post_likes`
and `post_comments` tables (same Supabase project as the website; see
`lib/community/types.ts` there for the reference shape this mirrors). An
account is known in the community by its dog(s) ("Nova" / "Nova & Rex"), not
the owner's name.

Anyone who reaches the customer app can read the feed; starting a post or
commenting requires an active membership. That's enforced in two places —
the composer only renders for members, **and** the database itself: a
migration (`community_feed_access`) added a `has_active_membership()`
Postgres function and tightened the `posts`/`post_comments` insert policies
to require it (or `is_admin()`), so a request can't route around the UI. The
same migration opened `dogs` to read-all-for-authenticated (previously
own-account-only), since the feed needs to show *other* members' dog names
and photos — `profiles` stays locked to each account's own row (it holds
email/phone, unlike `dogs`).

### 2. Your Dog (`customer/(tabs)/your-dog.tsx`)

Also reachable from the top-bar avatar. Real data throughout — `lib/dogs.ts`
reads `dogs` (breed, age from `date_of_birth`) and `skills`/`dog_skills` (an
overall level — same pillar/level algorithm as the website's
`config/skills.ts`, ported to `src/config/skills.ts`, driven by the dog's
real learnt-skills row). Multi-dog accounts get a switcher (pills, mirrors
the website's); the selected dog persists across launches (`lib/session.ts`,
`activeDog()` / `setActiveDog()`, AsyncStorage-backed like the website's
localStorage version).

Below the stats sits the dog's **latest report card** (`lib/homework.ts`'s
`getLatestReportCard()`) — title, session date, summary and its first few
homework items, with "+N more on the Homework tab" pointing at the full
library (see below). Deliberately **not** on this card: anything about the
next session or booking — that's Next Session's and Calendar's job.

### 3. Next Session (`customer/(tabs)/next-session.tsx`)

A read-only, at-a-glance view of the dog's schedule: an active-membership
row (`hasActiveMembership()`), then one large card for the next (or today's)
session — kind, date/time, location — with any trainer notice attached
(`training_sessions` + `session_notices`, same real tables as before;
`session_notices.kind` covers weather, heat, cancellation and general
info — a trainer-written weather notice is the "remember to pack a coat"
reminder, rather than an external weather API call). Rescheduling,
cancelling or booking extra sessions live on the Calendar tab, not here.

### 4. Calendar (`customer/(tabs)/calendar.tsx`)

Every upcoming session for the active dog (`lib/dogs.ts`'s
`getUpcomingSessions()`), each with inline **Reschedule**/**Cancel** links,
plus a **Book an extra session** button at the top. Members can't edit
`training_sessions` directly (RLS keeps that trainer-only) — everything here
is a *request* the trainer reviews, same as the website's cancellation
policy (`lib/calendar.ts`'s `requestReschedule()` / `requestCancellation()` /
`requestExtraSession()`, all writing to `reschedule_requests` /
`booking_requests`). There's no date picker yet — the reason/message field
is where a preferred date goes for now.

### 5. Homework (`customer/(tabs)/homework.tsx`)

The full homework library — every *published* report card's homework,
newest first (`lib/homework.ts`'s `getHomeworkLibrary()`). New homework
"unlocks" the library one card at a time as report cards are published, and
once unlocked it stays accessible forever. The most recent card is pinned
open at the top as the active practice checklist; older cards collapse into
the library below but are just as checkable, since homework gets practised
across many sessions, not once and done (`getCompletedItemIds()` /
`markHomeworkDone()`, writing to `homework_completions` — a repeatable log,
one row per mark-off, never un-checkable once done).

### 6. Chat & notifications (`customer/messages.tsx`, `customer/notifications.tsx`)

Reached from the top bar's chat icon and bell — pushed Stack screens, not
tabs. Both are real, live features, not stubs:

- **Chat** (`lib/chat.ts`) — one ongoing conversation per account with the
  trainer, backed by real `conversations`/`messages` tables (Realtime, so a
  staff reply appears instantly if the app's open). The trainer's side lives
  on the website at `/admin/chat`.
- **Notifications** (`lib/notifications.ts`) — a live, real list backed by
  the real `notifications` table (also Realtime), drives the bell's unread
  badge, and is the in-app path for three real events fired from the
  website's admin actions:
  - a staff **chat reply** (`/admin/chat`),
  - a **reschedule request accepted** (`/admin/reschedule-requests`),
  - a **new report card published** (`/admin/report-cards`).

  Tapping a notification marks it read and, for the two schedule/homework
  kinds, jumps straight to the relevant tab (Calendar / Homework); a chat
  notification opens Messages.
- **Real OS push** (the phone buzzes even with the app closed) —
  `lib/push.ts` registers an Expo push token on launch (permission +
  `profiles.push_token`) once the customer app loads. The website's
  `lib/push/notify.ts` sends to it directly (no edge function in the loop
  for these three events — the admin's Next.js server already has enough
  privilege via RLS to write the notification and call Expo's push API in
  the same request). **Needs an EAS project linked first**
  (`npx eas init` — see **Shipping to TestFlight** above, not done yet) for
  `app.json`'s `extra.eas.projectId` to exist; until then
  `registerForPushNotifications()` no-ops with a console warning and
  everything still works via the in-app/Realtime path above. Also needs a
  development build rather than Expo Go (Expo Go dropped remote push
  support in SDK 53).

`notifications.kind` also still reserves `pickup_eta`/`dropoff_eta` for the
deferred coach route-planner below — this table and its Realtime wiring
were originally built for that feature and are now shared by both.

## What was pulled back out

A walk/training tracker ("Strava for dog walks") and a coach
route-planner + pickup-notification system were built earlier in this
app's development, then deliberately removed to keep the first working
version simple — both are meant to come back as a later layer. Removed:
the whole `customer/walks/` + `(tabs)/walks.tsx` screens,
`components/walks/RouteMap.tsx`, `lib/walks.ts`, `lib/storage.ts`, the
`admin/index.tsx` route planner, and `lib/collections.ts`, plus the
`react-native-maps`/`expo-location`/`expo-image-picker` packages.
`admin/index.tsx` is back to a plain "coming soon" placeholder.
`lib/notifications.ts`/`lib/push.ts`/`expo-notifications` were removed in
that same pass, then reintroduced (generalized beyond just pickup ETAs) for
**Chat & notifications** above — they're real again, just not yet driving
the route-planner's "you're next for pickup" push.

**Nothing was dropped at the database level** — `walks`, `walk_points`,
`walk_photos`, `homework_completions`, `notifications`, the public `media`
Storage bucket, the `send-push` Edge Function, and
`profiles.pickup_address/pickup_lat/pickup_lng/push_token` +
`training_sessions.route_order/pickup_status` all still exist in the real
Supabase project, untouched — only the app code that read/wrote them was
removed, so this can be picked back up without redoing any migrations. See
git history on the files above (and on `admin/index.tsx`) for the working
implementation.

## Project structure

```
src/
  app/                     # Expo Router screens (file-based routing)
    _layout.tsx             # root Stack navigator, dark theme
    index.tsx                # entry point — auth/role gate (see above)
    login.tsx                 # Log in
    create-account.tsx         # Sign up
    forgot-password.tsx         # Password reset request
    pending.tsx                  # member, no dog on the account yet
    admin/
      index.tsx                  # placeholder — "Admin app — coming soon"
    customer/
      _layout.tsx                  # Stack: auth guard + push registration + (tabs)/notifications/messages
      notifications.tsx             # full notification list (from the bell)
      messages.tsx                    # real-time chat with the trainer (from the chat icon)
      (tabs)/
        _layout.tsx                   # tab shell (top bar + 5 tabs)
        index.tsx                      # 1. Home — the community feed
        your-dog.tsx                    # 2. Your Dog — stats, breed, latest report card
        next-session.tsx                 # 3. Next Session — membership + next/today's session
        calendar.tsx                      # 4. Calendar — upcoming sessions, reschedule/cancel/book
        homework.tsx                       # 5. Homework — the full accumulating library

  components/              # reusable UI primitives
    Logo.tsx                 # PLACEHOLDER logo mark — swap for the real logo
    Avatar.tsx                # round avatar (photo or initial fallback)
    TopBar.tsx                 # avatar · title · chat icon · notification bell (real, badged)
    Button.tsx                  # primary/secondary/ghost pill button
    TextField.tsx                # labelled input, matches the website's <Field>
    PlaceholderScreen.tsx          # "not built yet" stub
    community/
      Composer.tsx                  # collapsed pill -> post form (members only)
      PostCard.tsx                   # one feed post — edge-to-edge media, inline comments

  config/
    skills.ts                  # skill pillars/levels — mirrors the website's + the real `skills` table

  lib/
    supabase.ts               # Supabase client (AsyncStorage-backed session)
    session.ts                 # live account (role, owner, dogs, active dog)
    community.ts                # feed reads/writes — posts, likes, comments (+ photos)
    dogs.ts                      # per-dog stats, next/upcoming sessions + notices
    homework.ts                   # report cards + homework items, completion log
    calendar.ts                    # reschedule/cancellation/extra-session requests
    chat.ts                          # real-time conversation with the trainer
    notifications.ts                  # real-time in-app notifications store (the bell)
    push.ts                             # Expo push token registration -> profiles.push_token

  theme/
    colors.ts                  # colour tokens mirrored from the website
```

## Swapping in the real logo

`src/components/Logo.tsx` currently renders a placeholder "N&N" badge. Once
the real logo is ready:

1. Drop the file into `assets/images/` (e.g. `logo.png`).
2. Replace the placeholder `<View>` in `Logo.tsx` with an
   `<Image source={require("@/assets/images/logo.png")} />`.

Every screen picks up the change automatically since they all render `<Logo />`.

## What's built so far

- Login, create account and forgotten-password screens, wired up to
  Supabase auth.
- Role/membership-based routing (admin vs. customer vs. pending). No
  onboarding in the app itself — that happens on the website first, and an
  account arrives here already set up.
- The customer app shell — top bar + 5-tab bottom nav: **Home, Your Dog,
  Next Session, Calendar, Homework**.
- **Home**: a live community feed (posts, likes, comments, photos),
  membership-gated to post/comment at both the UI and the database layer.
- **Your Dog**: stats, breed, multi-dog switcher, and the latest report
  card's homework preview.
- **Next Session**: active-membership status + a large next/today's-session
  card with any real trainer notice (weather/heat/cancellation/info).
- **Calendar**: every upcoming session, with reschedule/cancel requests and
  a "book an extra session" request form.
- **Homework**: the full accumulating homework library across every
  published report card, most recent pinned open as an active checklist,
  older ones collapsible — all checkable, forever.
- **Chat & real-time notifications**: a live conversation with the trainer,
  plus a real, badged notification bell — both push to the phone too, for
  a staff chat reply, a reschedule request being accepted, and a new report
  card being published. The trainer's side of chat/reschedule/report-card
  publishing lives on the website at `/admin/chat`,
  `/admin/reschedule-requests` and `/admin/report-cards`.
- `admin/index.tsx` is a plain placeholder for now.

## What's next

Per the current build order, this app is being kept deliberately simple
until the five tabs above are working end-to-end. Queued for later:

- **Walk/training tracker** ("Strava for dog walks") and the coach
  **route-planner + pickup notifications** — both were built once already
  and pulled back out to simplify the first working version; see **What
  was pulled back out** above for exactly what that involved and what's
  still sitting in the database ready for it.
- The rest of the admin app beyond the placeholder and the three new real
  pages (`/admin/chat`, `/admin/reschedule-requests`, `/admin/report-cards`).
- Real app icon, splash screen and store listing assets.
- A date picker on the Calendar tab (reschedule/booking currently collect a
  free-text preferred date via the reason/message field).
- Linking an EAS project (`npx eas init`) — the one remaining step for real
  device push to actually deliver; the in-app/Realtime notification path
  works today regardless.

## Database

The real Supabase project ("Nelly and Nova") already has a much fuller
schema than the website's own client code uses yet — `report_cards`,
`training_sessions`, `skills`/`dog_skills`, `library_drills`, etc. all exist
for real. Run `list_tables` via the Supabase MCP tools (or the dashboard)
rather than assuming the website's `lib/*` sample-data scaffolding reflects
what's actually in the database — in several places (community, sessions,
reports) the real tables are already ahead of the website's own UI.

`walks`, `walk_points`, `walk_photos`, `homework_completions`,
`conversations`, `messages` and `notifications` (plus the public `media`
Storage bucket, the `send-push` Edge Function, and
`profiles.pickup_*`+`push_token` /
`training_sessions.route_order`+`pickup_status`) exist only because this
app added them — there's no equivalent on the website's own sample-data
scaffolding. Two are now live and driving real features:

- **`notifications`** — real, Realtime-enabled, and actively used by
  **Chat & notifications** above. `kind` currently allows `info`,
  `pickup_eta`, `dropoff_eta` (reserved for the deferred route planner),
  `chat_message`, `reschedule_accepted`, `report_card_published`.
- **`conversations`/`messages`** — real, Realtime-enabled, backing the chat
  feature on both this app (`lib/chat.ts`) and the website's `/admin/chat`
  (`lib/liveChat/` there).

`walks`, `walk_points`, `walk_photos` and the walk-tracker's
`homework_completions.walk_id` column are still just sitting there
untouched (see **What was pulled back out** above) — the app should
read/write them rather than inventing a parallel schema whenever that work
resumes. The `send-push` Edge Function is also still deployed but unused —
these three notification events call Expo's push API directly from the
website's Next.js server instead (see **Chat & notifications** above), so
it remains reserved for the deferred route planner's own push needs.
