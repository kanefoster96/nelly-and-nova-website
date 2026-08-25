# Nelly & Nova — App

Native mobile app (iOS + Android) for Nelly & Nova, built with
[Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router/introduction).
It shares its backend with the [website](../README.md) — the same Supabase
project handles auth, dog profiles, sessions, holidays and everything else,
so an account created on one works on the other.

This is **not** a wrapped website — it's a real React Native app, built
screen by screen to match the website's features (login, dog profiles,
session dates, reports, chat, etc.).

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
so no extra config is needed.

## Project structure

```
src/
  app/                  # Expo Router screens (file-based routing)
    _layout.tsx         # root Stack navigator, dark theme
    index.tsx           # entry point — redirects to /login for now
    login.tsx            # Log in
    create-account.tsx    # Sign up
    forgot-password.tsx    # Password reset request

  components/           # reusable UI primitives
    Logo.tsx             # PLACEHOLDER logo mark — swap for the real logo
    Button.tsx            # primary/secondary/ghost pill button
    TextField.tsx          # labelled input, matches the website's <Field>

  lib/
    supabase.ts           # Supabase client (AsyncStorage-backed session)

  theme/
    colors.ts              # colour tokens mirrored from the website
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

## What's next

- Screens for dog profiles, session dates/schedule, reports, chat/inbox,
  payments, etc. — mirroring the website's member area (see `app/profile/`
  and `lib/` in the root project for the shape of the data).
- Route guarding once authenticated screens exist (redirect signed-out users
  to `/login`, signed-in users away from it).
- Real app icon, splash screen and store listing assets.
