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
| `profiles.role === "admin"` | `/admin` (the coach app) |
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

## The coach app (`src/app/admin/`)

`admin/index.tsx`'s "coming soon" placeholder is gone — this is the real
trainer/coach side, same shell pattern as the customer app (`admin/_layout.tsx`
guards on `role === "admin"` + registers push, `admin/(tabs)/_layout.tsx` is
the 5-tab bar under the same `TopBar`, with the chat icon going to
`/admin/messages` and the bell to `/admin/notifications`; the avatar opens
the Menu tab, since there's no "your dog" for a coach).

Two constraints shaped every screen here, worth knowing before extending it:
there's **no live weather API anywhere in this codebase** (website included)
— "weather" always means the trainer-authored `session_notices` rows, same
as the customer app's Next Session card, not a forecast fetch; and **the
mobile app has no image picker any more** (removed in the earlier
simplification pass), so the drill library editor below is text-only for now.

### 1. Dashboard (`admin/(tabs)/index.tsx`)

Today's dogs — every `training_sessions` row scheduled today, in order,
with any attached `session_notices` (weather/heat/cancellation/info)
surfaced as a banner up top. Real data via `lib/adminSchedule.ts`'s
`getSessionsForToday()`.

### 2. Home (`admin/(tabs)/home.tsx`)

The exact same community feed as the customer app's Home tab — both now
render a shared `components/community/CommunityFeed.tsx` (factored out of
the old `customer/(tabs)/index.tsx`, which lost nothing, it just delegates
now). A coach can always post, per the `posts` RLS policy's `is_admin()`
clause.

Pinned above the feed: `components/admin/BroadcastComposer.tsx` — a
collapsed "Send a notification to all customers" pill that expands into a
title + message + an "Also email everyone" switch. `lib/broadcast.ts`'s
`sendBroadcast()`:
- inserts a real `notifications` row (`kind: "info"`) and sends a real push
  for every real member, the same client-side pattern as `lib/adminNotify.ts`
  (no server hop needed — RLS already lets an admin write on any account's
  behalf, and Expo's push-send endpoint takes no secret);
- if "Also email everyone" is on, calls the new **`broadcast-email`** Edge
  Function (admin-JWT-checked, mirrors `send-push`'s auth pattern), which
  loops every member's `profiles.email` through Resend. That needs a
  `RESEND_API_KEY` **Supabase project secret** — separate from the website's
  own Vercel-only env var of the same name — or it silently reports 0 sent
  or a "skipped" note, same best-effort shape as the website's
  `lib/email/resend.ts`.

### 3. Calendar (`admin/(tabs)/calendar.tsx`)

A month grid (`lib/adminSchedule.ts`'s `getSessionsInRange()`), each day
tinted by what's on it that day — plain if nothing's scheduled, accent if
sessions are, amber if any has a weather/heat notice, red if any has a
cancellation notice (a legend sits under the grid). Tapping a day opens a
sheet listing that day's sessions; tapping one of those opens a reschedule
sheet for that dog with two modes:

- **This session only** — a one-off move: type a new date + time,
  `rescheduleOneOff()` updates just that `training_sessions` row.
- **This & every future one** — the real schema has no recurring-slot row
  (unlike the website's legacy `lib/schedule/` sample data), just individual
  dated sessions, so "permanent" means bulk-updating every future
  `status = 'scheduled'` session for that dog that falls on the same weekday
  as the one you opened, to a new weekday + time
  (`reschedulePermanent()` in `lib/adminSchedule.ts`).

No date-picker library is wired in (same pragmatic choice as the customer
Calendar tab) — date/time are plain `YYYY-MM-DD`/`HH:MM` text fields.

### 4. Homework — drill library editor (`admin/(tabs)/homework.tsx`)

Pillar (Engagement / Skills / Mindset) → category → drills-by-level → a
drill's content blocks, all real: `library_categories` (already seeded with
9 real rows), `library_drills`, `library_drill_blocks`
(`lib/drillLibrary.ts`). Add a category, add a drill at a level, delete a
drill, and edit a drill's blocks — heading/paragraph text only for now (see
the image-picker note above); blocks reorder with up/down arrows, the same
reliability-over-drag-and-drop choice used elsewhere in this app.

### 5. Menu (`admin/(tabs)/menu.tsx`)

Real customers: every `profiles.role = 'member'` row with their `dogs`
(`lib/adminMembers.ts`), tap to expand a card and see email/phone/dogs. A
**Payments** section is present but explicitly says "not connected yet" —
there is no real payment backend anywhere in this codebase (the website's
own payments screens are sample/localStorage data too, no live GoCardless
integration), so this deliberately doesn't pretend otherwise. Also: log out.

### Chat & notifications, coach side (`admin/messages/`, `admin/notifications.tsx`)

`admin/messages/index.tsx` lists every real conversation
(`lib/adminChat.ts`'s `getConversationsForAdmin()`), newest activity first,
with an unread dot; tapping one opens `admin/messages/[id].tsx`, a thread
screen sharing `lib/chat.ts`'s `getMessages()`/`subscribeToMessages()` with
the customer side, but sending through `sendStaffMessage()` — which also
calls `lib/adminNotify.ts` to push+notify that customer, same as the
website's `/admin/chat`. `admin/notifications.tsx` reuses the same
`components/notifications/NotificationsList.tsx` the customer app's bell
uses, just with its own tap-through routes (currently only `chat_message` →
`/admin/messages`, since the other two kinds are things a coach causes, not
receives).

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
      _layout.tsx                  # Stack: auth guard (role=admin) + push registration + (tabs)/notifications/messages
      notifications.tsx             # full notification list (from the bell)
      messages/
        index.tsx                    # every real conversation, newest first
        [id].tsx                      # one conversation's thread (send as staff)
      (tabs)/
        _layout.tsx                   # tab shell (top bar + 5 tabs)
        index.tsx                      # 1. Dashboard — today's sessions + notices
        home.tsx                        # 2. Home — community feed + broadcast composer
        calendar.tsx                     # 3. Calendar — month grid + reschedule (one-off/permanent)
        homework.tsx                      # 4. Homework — drill library editor (pillar/category/drill/blocks)
        menu.tsx                           # 5. Menu — real customer/dog browser, payments (not connected), log out
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
      CommunityFeed.tsx              # shared feed rendering — customer Home + coach Home
      Composer.tsx                    # collapsed pill -> post form (members only, or coach)
      PostCard.tsx                     # one feed post — edge-to-edge media, inline comments
    notifications/
      NotificationsList.tsx          # shared bell-list rendering — customer + coach notifications
    admin/
      BroadcastComposer.tsx          # notification/email blast to every member

  config/
    skills.ts                  # skill pillars/levels — mirrors the website's + the real `skills` table

  lib/
    supabase.ts               # Supabase client (AsyncStorage-backed session)
    session.ts                 # live account (role, owner, dogs, active dog)
    community.ts                # feed reads/writes — posts, likes, comments (+ photos)
    dogs.ts                      # per-dog stats, next/upcoming sessions + notices
    homework.ts                   # report cards + homework items, completion log
    calendar.ts                    # reschedule/cancellation/extra-session requests
    chat.ts                          # real-time conversation with the trainer (member side)
    notifications.ts                  # real-time in-app notifications store (the bell)
    push.ts                             # Expo push token registration -> profiles.push_token
    adminChat.ts                         # coach side of chat — list conversations, send as staff
    adminNotify.ts                        # notify+push one member (coach-triggered events)
    broadcast.ts                           # notify+push every member, optional email fan-out
    adminSchedule.ts                        # today's/month's sessions, one-off & permanent reschedule
    adminMembers.ts                          # real customer/dog browser
    drillLibrary.ts                           # homework drill library CRUD (categories/drills/blocks)

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
- **The coach app** (`admin/`) — real, not a placeholder any more: a
  Dashboard (today's sessions + notices), Home (the same community feed,
  plus a notification/email blast to every customer), Calendar (a
  colour-coded month grid with one-off and permanent reschedule), a
  Homework drill-library editor (real categories/drills/text blocks), a
  Menu (real customer/dog browser; Payments explicitly marked "not
  connected"), and its own chat inbox + notifications.

## What's next

- **Walk/training tracker** ("Strava for dog walks") and the customer-facing
  half of the coach **route-planner + pickup notifications** — both were
  built once already and pulled back out to simplify the first working
  version; see **What was pulled back out** above for exactly what that
  involved and what's still sitting in the database ready for it.
- Real app icon, splash screen and store listing assets.
- A date/time picker on the Calendar tabs (both apps currently collect
  dates via plain text fields — `YYYY-MM-DD`/`HH:MM`).
- Photo/video blocks in the drill library editor — needs an image picker
  back (removed in the earlier simplification pass); text blocks work today.
- A real payments backend — nothing in this codebase (website or app) talks
  to a live payment provider yet; the coach Menu tab says so rather than
  faking it.
- Linking an EAS project (`npx eas init`) — the one remaining step for real
  device push to actually deliver; the in-app/Realtime notification path
  works today regardless.
- Setting the `RESEND_API_KEY` Supabase project secret (`supabase secrets
  set`, or the dashboard) — the one remaining step for the Home tab's
  "Also email everyone" toggle to actually send; the in-app/push part of a
  broadcast works today regardless. This is a *project* secret, separate
  from the website's own `RESEND_API_KEY` in its Vercel env.

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
  `chat_message`, `reschedule_accepted`, `report_card_published`,
  `broadcast` (the coach Home tab's "notify everyone").
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

`library_categories`/`library_drills`/`library_drill_blocks` and `skills`/
`dog_skills` also predate this pass (used for real by `config/skills.ts`'s
level algorithm already) but only got a real *editor* now, in the coach
app's Homework tab (`lib/drillLibrary.ts`) — the website's own
`/admin/homework` still edits a separate `config/homeworkLibrary.ts` +
localStorage overlay (`lib/homework-library/store.ts`), not these tables, so
the two aren't in sync yet.

### Edge Functions

- **`send-push`** — deployed, unused (see above; reserved for the deferred
  route planner).
- **`broadcast-email`** — real, used by the coach app's Home tab blast.
  Admin-JWT-checked the same way `send-push` is, then emails every real
  member via Resend using a `RESEND_API_KEY` **Supabase project secret**
  (`supabase secrets set RESEND_API_KEY=...`, or the dashboard) — separate
  from the website's own env var of the same name. No key set → it reports
  back "skipped" rather than failing; the notification/push half of a
  broadcast always goes out regardless, since that part doesn't touch email
  at all.
