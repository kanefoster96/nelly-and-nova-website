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

- **Top bar** (`components/TopBar.tsx`) — account avatar top-left, app name
  centred, notifications bell top-right.
- **Bottom tabs** (`customer/_layout.tsx`) — 5 items: Home, Sessions,
  Reports, Community, Messages.

Only Home (`customer/index.tsx`) has real content right now (the signed-in
owner's name and their dogs, straight from Supabase) — proof the shell is
live-wired. The other four tabs are intentionally stubs
(`components/PlaceholderScreen.tsx`) until their pages are built.

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
      _layout.tsx                 # tab shell (top bar + 5 tabs), guarded
      index.tsx                    # Home — real Supabase data
      sessions.tsx                  # stub
      reports.tsx                    # stub
      community.tsx                   # stub
      messages.tsx                     # stub

  components/              # reusable UI primitives
    Logo.tsx                 # PLACEHOLDER logo mark — swap for the real logo
    Avatar.tsx                # round avatar (photo or initial fallback)
    TopBar.tsx                 # avatar · title · notification bell
    Button.tsx                  # primary/secondary/ghost pill button
    TextField.tsx                # labelled input, matches the website's <Field>
    PlaceholderScreen.tsx          # "not built yet" stub for a tab

  lib/
    supabase.ts               # Supabase client (AsyncStorage-backed session)
    session.ts                 # live account (role, owner, dogs) — see above

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
- The customer app shell — top bar + 5-tab bottom nav — with a live Home tab.

## What's next

Menu pages for Sessions, Reports, Community and Messages — mirroring the
website's member area (see `app/profile/`, `app/community/`, `app/messages/`
and `lib/` in the root project for the shape of the data). Held off
deliberately until asked for, per the current build order. Also queued:

- The admin app (currently a placeholder screen).
- Wiring the notification bell up to real data once a `notifications` table
  exists (the website's own inbox is still sample data too — see
  `lib/inbox/data.ts` in the root project).
- Real app icon, splash screen and store listing assets.
