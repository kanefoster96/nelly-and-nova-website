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
- **react-native-maps**, **expo-location**, **expo-image-picker** — the walk tracker

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the Supabase URL + anon key
npm run start           # opens Expo dev tools — scan the QR with Expo Go,
                         # or press i / a for a simulator/emulator
```

Other scripts:

```bash
npm run ios      # iOS simulator (macOS only)
npm run android  # Android emulator
npm run web      # run in a browser (handy for quick UI iteration)
npm run lint     # eslint
```

## Environment

Copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_SUPABASE_URL` — same value as the website's `NEXT_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same value as the website's `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Expo automatically inlines any `EXPO_PUBLIC_*` variable into the JS bundle,
so no extra config is needed. Without a `.env`, the app still renders (a
console warning is logged) but every Supabase call fails, which
`lib/session.ts` treats as signed-out.

### Maps (Android)

The walk tracker's maps (`components/walks/RouteMap.tsx`, via
`react-native-maps`) use Apple Maps on iOS — no key needed, it just works.
**Android needs a Google Maps API key** to render anything. Add one under
`plugins → ["react-native-maps", { "androidGoogleMapsApiKey": "…" }]` in
`app.json` before testing on Android; without it the map area renders blank
on that platform (everything else — timer, distance, saving, sharing —
still works).

### Push notifications

Real device push (e.g. a coach's "you're next for pickup" reaching the
phone even with the app closed) needs this project linked to an EAS
project: run `npx eas init` (a free Expo account, one-time). That writes
`extra.eas.projectId` into `app.json` — nothing else changes, since
`lib/push.ts` already reads it. Without it, push registration no-ops (a
console warning) and everything still works via the in-app/Realtime
notifications (the bell, the profile card's ETA banner) — see **Collection
routes & pickup ETAs** below. Also needs a development build rather than
Expo Go (`expo run:ios` / `expo run:android`, or an EAS build) — Expo Go
dropped remote push support in SDK 53.

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

An Instagram-style shell:

- **Top bar** (`components/TopBar.tsx`) — account avatar top-left (opens the
  dog profile card, see below), app name centred, notifications bell
  top-right.
- **Bottom tabs** (`customer/(tabs)/_layout.tsx`) — 5 items: Home, **Walks**,
  Sessions, Reports, Messages.

The original 5 were Home/Sessions/Reports/Community/Messages; **Community
was dropped and replaced with Walks** once Home became the community feed
itself (see below) — a separate Community tab had nothing left to do, and
the walk/training tracker (this session's build) explicitly needed to be
"its own menu item", not just a button off the profile card.

`customer/` is a Stack (`customer/_layout.tsx`, holds the auth/membership
guard) with children beyond the `(tabs)` group for anything that shouldn't
be a 6th tab: `profile` (from the top-bar avatar), `walks/track` (the live
recording screen — full-bleed, own close button, no header) and
`walks/[id]` (one walk's detail page). Any future screen like this
(session detail, report card detail, …) belongs alongside them, not inside
`(tabs)`.

**Layout rule for every screen in the app:** nothing sits inside a padded
"container" unless it's a genuinely intentional card (a notice, a comment
bubble, the composer, a form). Feed content, images and list-style content
run edge-to-edge like Instagram/Facebook — screens/lists carry no horizontal
padding themselves; individual rows (text, avatars, buttons) add their own.
See `customer/index.tsx` / `components/community/PostCard.tsx` for the
reference implementation (media has zero inset; text/actions do).

### Home = the community feed

Home (`customer/index.tsx`) is a live Facebook-wall-style feed —
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

Sessions, Reports and Messages are still stubs (`components/PlaceholderScreen.tsx`).

### The dog profile card (`customer/profile.tsx`)

Reached from the top-bar avatar. Real data throughout — `lib/dogs.ts` reads
`dogs` (breed, age from `date_of_birth`), `skills`/`dog_skills` (an overall
level — same pillar/level algorithm as the website's `config/skills.ts`,
ported to `src/config/skills.ts`, driven by the dog's real learnt-skills
row), and `training_sessions`/`session_notices` (the next/today's session,
with any notice attached — `session_notices.kind` covers weather, heat,
cancellation and general info; a trainer-written weather notice is the
"remember to pack a coat" reminder, rather than an external weather API
call).

Multi-dog accounts get a switcher (pills, mirrors the website's); the
selected dog persists across launches (`lib/session.ts`, `activeDog()` /
`setActiveDog()`, AsyncStorage-backed like the website's localStorage
version). "Walks" and "Reports" buttons hand off to those.

Deliberately **not** on this card: rescheduling or booking an extra
session, or changing plan — that's the Sessions tab's job (calendar icon,
already scaffolded), kept separate per how this was scoped. Only a
read-only next-session summary + any notice lives on the profile card.

**Pickup location**: the next-session block also shows where this account
is collected from for Walk & Train — tap it to set/edit
(`customer/pickup-location.tsx`: an address the owner types by hand, plus a
"use my current location" button that drops a pin via `expo-location`, no
geocoding key needed since only the coordinates matter for routing).
Persisted on `profiles.pickup_address/pickup_lat/pickup_lng`
(`lib/session.ts`, `setPickupLocation()`) — the same fields the coach's
route planner reads (see **Collection routes** below).

**Pickup ETA banner**: if the coach has sent a "you're next" notification
today (see below), it shows right on the profile card, above the
next-session block — real-time, not a refresh-to-see (`lib/notifications.ts`,
Supabase Realtime).

### Walks — a Strava-style tracker (`customer/walks/` + `(tabs)/walks.tsx`)

Its own tab (see above). Three screens:

- **`(tabs)/walks.tsx`** — history for the active dog, newest first (kind,
  date, duration, distance, place, a shared badge), plus "Start a walk".
  Tapping a row opens its detail page.
- **`walks/track.tsx`** — the live recording screen, full-bleed with its own
  close button (no header/tab bar, like Strava's recording view). A small
  state machine (idle → tracking → finished):
  - **Start** picks Walk or Training, tags a start location via
    `expo-location` (best-effort — tracking still works if permission is
    denied).
  - **Tracking** samples the route continuously (`Location.watchPositionAsync`,
    every ~10 m / 5 s while the screen is open — foreground only, no
    background-location entitlements needed) and draws it live on a map
    (`components/walks/RouteMap.tsx`, `react-native-maps`) with a running
    timer and distance (great-circle sum over the sampled points,
    `routeDistanceMeters()` in `lib/walks.ts`). The dog's **current
    homework** (their most recent *published* report card's items — real
    `report_cards`/`report_card_items`) is shown so items can be ticked off
    mid-session.
  - **Stop → finished**: name the place, add notes, attach photos (picker or
    camera, `expo-image-picker`), then optionally **share to the
    community feed** → Save.
- **`walks/[id].tsx`** — a walk's detail page: full route map, duration /
  distance / pace, place, notes, homework practiced, and its photos —
  plus a "Share to community" button if it wasn't shared at save time.

New tables (`walk_tracker` + `walk_tracker_strava` migrations):

- **`walks`** — the owner's own log (insert/update/delete gated to their
  account via RLS, unlike the trainer-only-written `training_sessions`),
  now also carrying `distance_meters`, `location_name`, and start/end
  lat/lng.
- **`walk_points`** — the sampled route, batch-inserted on save (not
  written point-by-point during tracking, so a flaky connection mid-walk
  can't lose progress — everything's held client-side until Stop).
- **`walk_photos`** — photos attached to a walk regardless of whether/when
  it's shared (sharing reuses the same uploaded URLs in `post_media`,
  rather than re-uploading).
- **`homework_completions`** — unchanged from before: a repeatable log, one
  row per mark-off, not a one-off checkbox, since homework gets practiced
  across many sessions.

A `walks` row is inserted the moment you hit Start (so a homework mark
mid-walk has something to link to via `walk_id`) and updated on Stop; the
history list only shows finished walks (`ended_at is not null`).

**Storage**: a new public `media` bucket (Supabase Storage) holds uploaded
images — writes are scoped to the uploader's own folder
(`{account_id}/...`) via storage RLS, reads are public since this is
community content. `lib/storage.ts` has the upload helper
(`uploadImage(localUri, folder)`); `lib/community.ts`'s `createPost()` now
takes an optional `mediaUrls[]` so any post (not just a shared walk) can
carry photos once there's a picker on the composer too.

Sharing composes a post from duration/distance/place/notes and calls the
same membership-gated `createPost()` from the community feed, with any
photo URLs attached, then links `walks.shared_post_id` back to it — so a
shared walk **is** a community post (recommending a place, showing
progress/issues) and shows up in Home like any other.

`lib/walks.ts` has the full data layer: `startWalk`, `finishWalk`,
`uploadWalkPhotos`, `markHomeworkDone`, `getHomeworkForDog`, `getWalks`,
`getWalkDetail`, `shareWalkToCommunity`, `routeDistanceMeters`.

**Scoped down deliberately:** tracking is foreground-only (the screen must
stay open/awake — no background-location permissions, which need extra App
Store justification and entitlements); no editing/deleting a past walk; no
automatic place lookup from coordinates (an owner types the location name
by hand rather than this reverse-geocoding, which would need a geocoding
API key). See **Maps (Android)** above for the one manual setup step this
needs.

### Collection routes & pickup ETAs (`admin/index.tsx` + `lib/collections.ts`)

The first real piece of the admin/coach app: a route planner for today's
Walk & Train collections, and the notification that reaches an owner when
the coach is heading their way.

- **`admin/index.tsx`** — today's collections (real `training_sessions`
  where `kind = 'walk-and-train'`, scheduled today), in route order, each
  showing the dog/owner, time, pickup address (from the owner's saved
  `profiles.pickup_*`) and a pending/en-route/collected status. Up/down
  arrows reorder the route (persisted to `route_order`) — deliberately
  arrow buttons, not drag-and-drop, for reliability. **Start next pickup**
  marks the current "en route" stop collected and sends the *next* pending
  stop's owner a notification.
- **No live coach location, by design** — the ask was explicitly that
  customers shouldn't see it.
- **No precise ETA, deliberately** — a real one needs a paid Directions API
  key just to say "you're roughly next"; not worth it. Every notification
  sends the same fixed heads-up — "usually around 10–20 minutes" — the
  moment "Start next pickup" is tapped, rather than computing a number from
  distance/speed. (An earlier version of this did estimate from straight-line
  distance between saved pickup points; dropped in favour of this simpler,
  free, equally-honest fixed window.)

**Notifications are real two ways now:**

- **In-app / Realtime** — the `notifications` table (staff-insert-only via
  RLS; an owner can only read/mark-read their own) is in the
  `supabase_realtime` publication, so `lib/notifications.ts` gets pushed
  updates instantly over a Realtime channel — no polling. Drives the
  top-bar bell's unread badge (`useUnreadNotificationCount()`), the profile
  card's ETA banner (`useLatestPickupEta()`), and the full list at
  `customer/notifications.tsx` (tap to mark read, "mark all as read"). Works
  the moment the app is open, or the next time it is.
- **Real OS push** (the phone buzzes even with the app closed) —
  `lib/push.ts` registers an Expo push token (permission + `profiles.push_token`)
  once the customer app loads, and `startNextPickup()` calls the new
  `send-push` **Edge Function** with that token. The function re-checks the
  caller is an admin itself (not just RLS) before relaying to Expo's push
  API, so it can't be used to spam arbitrary accounts. **This needs the
  project linked to an EAS project** (`npx eas init` — free Expo account,
  one-time, not done yet) for `app.json`'s `extra.eas.projectId` to exist;
  until then `registerForPushNotifications()` no-ops with a console
  warning and everything still works via the in-app/Realtime path above.
  Also: push notifications need a development build, not Expo Go (Expo Go
  dropped remote push support in SDK 53).

**Not built:** the rest of the admin app beyond this one screen, and
drag-and-drop route reordering (arrows only, for now).

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
      index.tsx                  # today's collection route planner (see above) — rest is placeholder
    customer/
      _layout.tsx                  # Stack: guard + (tabs) + profile + walks/* + pickup-location + notifications
      profile.tsx                   # dog profile card (pushed, from top-bar avatar)
      pickup-location.tsx            # set/edit the account's collection pickup point
      notifications.tsx               # full notification list (from the bell)
      walks/
        track.tsx                     # live recording screen: map, timer, homework, share
        [id].tsx                       # one walk's detail — route map, stats, photos
      (tabs)/
        _layout.tsx                   # tab shell (top bar + 5 tabs)
        index.tsx                      # Home — the community feed
        walks.tsx                       # walk/training history + "Start a walk"
        sessions.tsx                     # stub (reschedule/book extra/change plan → here)
        reports.tsx                       # stub
        messages.tsx                       # stub

  components/              # reusable UI primitives
    Logo.tsx                 # PLACEHOLDER logo mark — swap for the real logo
    Avatar.tsx                # round avatar (photo or initial fallback)
    TopBar.tsx                 # avatar · title · notification bell (real unread badge)
    Button.tsx                  # primary/secondary/ghost pill button
    TextField.tsx                # labelled input, matches the website's <Field>
    PlaceholderScreen.tsx          # "not built yet" stub for a tab
    community/
      Composer.tsx                  # collapsed pill -> post form (members only)
      PostCard.tsx                   # one feed post — edge-to-edge media, inline comments
    walks/
      RouteMap.tsx                    # route polyline + live/start/finish markers — also used
                                        # for a single pickup pin on pickup-location.tsx

  config/
    skills.ts                  # skill pillars/levels — mirrors the website's + the real `skills` table

  lib/
    supabase.ts               # Supabase client (AsyncStorage-backed session)
    session.ts                 # live account (role, owner, dogs, active dog, pickup location)
    community.ts                # feed reads/writes — posts, likes, comments (+ photos)
    dogs.ts                      # per-dog stats, next session + notices
    walks.ts                      # walk/training log, route, photos, homework mark-off, share
    storage.ts                     # image upload → the `media` Storage bucket
    notifications.ts                # real-time notifications store (Supabase Realtime)
    push.ts                          # Expo push token registration + sendPushNotification()
    collections.ts                    # coach route planning + "Start next pickup"

  theme/
    colors.ts                  # colour tokens mirrored from the website
```

## Edge Functions

- **`send-push`** — relays one push notification to Expo's push API on
  behalf of an admin action (`lib/push.ts`'s `sendPushNotification()`).
  Requires a valid JWT (`verify_jwt: true`) and re-checks the caller is
  `profiles.role = 'admin'` itself before sending, so it can't be used to
  push arbitrary messages to arbitrary accounts even by another signed-in
  member. Deployed via the Supabase MCP tools — view/redeploy with
  `list_edge_functions` / `deploy_edge_function` against project
  `kqreuupspgifbhhxpfxu`.

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
- Role/membership-based routing (admin vs. customer vs. pending).
- The customer app shell — top bar + 5-tab bottom nav (Home, Walks,
  Sessions, Reports, Messages).
- Home: a live community feed (posts, likes, comments, photos),
  membership-gated to post/comment at both the UI and the database layer.
- The dog profile card (avatar → `/customer/profile`): stats, breed,
  multi-dog switcher, next/today's session with any real trainer notice
  (weather/heat/cancellation/info), and a hand-off to Reports and Walks.
- **Walks** (its own tab): a Strava-style tracker — live route map,
  timer, distance, homework mark-off mid-session, place + notes + photos,
  a history list, per-walk detail pages, and sharing a finished walk to
  the community feed (as a real post, with photos).
- **Pickup location** on the profile card, owner-editable, feeding straight
  into the coach's route planner.
- **Real, live notification bell** — unread badge + full list, pushed
  instantly over Supabase Realtime, *and* real OS push via a `send-push`
  Edge Function once `eas init` links a project (in-app path works either
  way).
- **Collection route planner** (`admin/index.tsx`, the first real admin
  screen): today's Walk & Train stops in order, reorderable, "Start next
  pickup" sends the next owner a heads-up (a fixed ~10–20 min window, not
  a computed ETA — no Directions API key needed or wanted). No live coach
  location — by design, per the ask.

## What's next

Menu pages for Sessions, Reports and Messages — mirroring the website's
member area (see `app/profile/`, `app/messages/` and `lib/` in the root
project for the shape of the data). Held off deliberately until asked for,
per the current build order. Sessions in particular now owns rescheduling,
booking an extra session and changing plan — deliberately kept off the
profile card. Also queued:

- Background location for walks (currently foreground-only — the tracking
  screen has to stay open) and editing/deleting a past walk.
- Automatic place lookup from coordinates (currently a manual text field) —
  needs a geocoding API key. Same applies to the pickup-location screen.
- A photo picker on the community composer itself (`createPost()` already
  accepts `mediaUrls[]` — the walk-share flow uses it; the composer UI just
  doesn't have a picker yet).
- The rest of the admin app beyond the collection route planner.
- Linking an EAS project (`npx eas init`, needs a free Expo account) — the
  one remaining step for real device push to actually deliver; everything
  else for it is built (see **Collection routes & pickup ETAs** above).
- Real app icon, splash screen and store listing assets.
- An Android Google Maps API key (see **Maps (Android)** above) — iOS maps
  work out of the box.

## Database

The real Supabase project ("Nelly and Nova") already has a much fuller
schema than the website's own client code uses yet — `report_cards`,
`training_sessions`, `skills`/`dog_skills`, `library_drills`, etc. all exist
for real, ready for those menu pages when we get to them. Run `list_tables`
via the Supabase MCP tools (or the dashboard) rather than assuming the
website's `lib/*` sample-data scaffolding reflects what's actually in the
database — in several places (community, sessions, reports) the real tables
are already ahead of the website's own UI.

`walks`, `walk_points`, `walk_photos`, `homework_completions` and
`notifications` (plus the public `media` Storage bucket, the `send-push`
Edge Function, and `profiles.pickup_*`+`push_token` /
`training_sessions.route_order`+`pickup_status`) exist only because this
app added them — there's no equivalent on the website
yet. If the website ever gets its own walk-tracking or route-planning UI,
it should read/write these same tables rather than inventing a parallel
schema.
