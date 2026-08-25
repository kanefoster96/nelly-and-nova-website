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
- **Supabase** (`@supabase/supabase-js`) — same project as the website

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
- **Bottom tabs** (`customer/(tabs)/_layout.tsx`) — 5 items: Home, Sessions,
  Reports, Community, Messages.

`customer/` is a Stack (`customer/_layout.tsx`, holds the auth/membership
guard) with two children: the `(tabs)` group above, and `profile` — a screen
pushed on top of the tabs (its own back button, tab bar hidden), reached by
tapping the top-bar avatar. Any future screen that shouldn't be a 6th tab
(session detail, report card detail, …) belongs here alongside `profile`,
not inside `(tabs)`.

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

Sessions, Reports, Community (as a separate tab) and Messages are still
stubs (`components/PlaceholderScreen.tsx`).

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
version). A "Reports" button hands off to the Reports tab.

Deliberately **not** on this card: rescheduling or booking an extra
session, or changing plan — that's the Sessions tab's job (calendar icon,
already scaffolded), kept separate per how this was scoped. Only a
read-only next-session summary + any notice lives on the profile card.

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
      index.tsx                  # admin app placeholder
    customer/
      _layout.tsx                  # Stack: guard + (tabs) + profile
      profile.tsx                   # dog profile card (pushed, from top-bar avatar)
      (tabs)/
        _layout.tsx                   # tab shell (top bar + 5 tabs)
        index.tsx                      # Home — the community feed
        sessions.tsx                    # stub (reschedule/book extra/change plan → here)
        reports.tsx                      # stub
        community.tsx                     # stub
        messages.tsx                       # stub

  components/              # reusable UI primitives
    Logo.tsx                 # PLACEHOLDER logo mark — swap for the real logo
    Avatar.tsx                # round avatar (photo or initial fallback)
    TopBar.tsx                 # avatar · title · notification bell
    Button.tsx                  # primary/secondary/ghost pill button
    TextField.tsx                # labelled input, matches the website's <Field>
    PlaceholderScreen.tsx          # "not built yet" stub for a tab
    community/
      Composer.tsx                  # collapsed pill -> post form (members only)
      PostCard.tsx                   # one feed post — edge-to-edge media, inline comments

  config/
    skills.ts                  # skill pillars/levels — mirrors the website's + the real `skills` table

  lib/
    supabase.ts               # Supabase client (AsyncStorage-backed session)
    session.ts                 # live account (role, owner, dogs, active dog) — see above
    community.ts                # feed reads/writes — posts, likes, comments
    dogs.ts                      # per-dog stats, next session + notices

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
- Role/membership-based routing (admin vs. customer vs. pending).
- The customer app shell — top bar + 5-tab bottom nav.
- Home: a live community feed (posts, likes, comments), membership-gated to
  post/comment at both the UI and the database layer.
- The dog profile card (avatar → `/customer/profile`): stats, breed,
  multi-dog switcher, next/today's session with any real trainer notice
  (weather/heat/cancellation/info), and a hand-off to Reports.

## What's next

Menu pages for Sessions, Reports and Messages (the Community tab may fold
into Home now that Home *is* the feed — to be decided) — mirroring the
website's member area (see `app/profile/`, `app/messages/` and `lib/` in the
root project for the shape of the data). Held off deliberately until asked
for, per the current build order. Sessions in particular now owns
rescheduling, booking an extra session and changing plan — deliberately kept
off the profile card. Also queued:

- Photo/video attachments on posts — `post_media` and the display side (the
  edge-to-edge media grid) are ready; there's no image picker/upload flow
  yet, so posting is text-only for now.
- The admin app (currently a placeholder screen).
- Wiring the notification bell up to real data once a `notifications` table
  exists (the website's own inbox is still sample data too — see
  `lib/inbox/data.ts` in the root project).
- Real app icon, splash screen and store listing assets.

## Database

The real Supabase project ("Nelly and Nova") already has a much fuller
schema than the website's own client code uses yet — `report_cards`,
`training_sessions`, `skills`/`dog_skills`, `library_drills`, etc. all exist
for real, ready for those menu pages when we get to them. Run `list_tables`
via the Supabase MCP tools (or the dashboard) rather than assuming the
website's `lib/*` sample-data scaffolding reflects what's actually in the
database — in several places (community, sessions, reports) the real tables
are already ahead of the website's own UI.
