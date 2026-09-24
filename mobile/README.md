# Nelly & Nova — iOS/Android app

Native members-only app built with **Expo SDK 57** + **Expo Router**. It uses
the **same Supabase project** as the website and ships JavaScript changes
**over the air with EAS Update**, with no App Store review needed. Over time the
members' features move out of the website and live only here.

**Look and feel** matches the Kanvas Academy app (`kanvas-academy-website/mobile`):
the same dark theme tokens, the Instagram-style top bar (avatar → Profile, NN
mark, bell → Notifications with an unread badge), an Ionicons tab bar, and the
same layouts for the community feed, chat, inbox, notifications, profile rows
and the calendar-style schedule. Chat has no AI suggested replies.

**Flow:** sign-in (members only; "Become a Member" sends people to
www.nellyandnova.co.uk) → four tabs. Each tab shows the member side or the
trainer side depending on `profiles.role` (`admin` = trainer).

| Screen | Member | Trainer |
| --- | --- | --- |
| Community | feed, composer (photos/videos), likes, comments, report/block | same, plus pin posts and delete anyone's |
| Homework | latest report card + homework, "I practised today" | drill library → drill pages |
| Schedule | their upcoming sessions by day | next 14 days, dogs booked, spaces, held/alternating |
| Chat | one thread with the team (photo/video/file attachments) | Inbox (search, filters) → conversation (call, mark complete) |
| Profile (avatar) | dogs (live), progress, change password, sign out | role, sign out |
| Notifications (bell) | report cards, messages, likes | comments, booking requests |

Profile/role and dogs are live from Supabase. The rest runs on sample data
behind `TODO(backend)` functions in `src/data/`; see `src/data/README.md`.

```
src/
  app/
    _layout.tsx           # auth gate (Stack.Protected), splash, OTA hook, providers
    sign-in.tsx           # members-only login
    (app)/
      (tabs)/             # top bar + tab bar: community, homework, schedule, chat
      profile.tsx         # pushed from the avatar
      notifications.tsx   # pushed from the bell
      conversation/[id]   # trainer: one conversation
      drill/[id]          # trainer: a drill page
  auth/AuthProvider.tsx   # session + profile (role, name, avatar)
  components/             # Kanvas-style UI: top-bar, nav-row, avatar-circle,
                          # community/, chat/, schedule/, homework/, …
  data/                   # data layer (types, sample data, Supabase seams)
  lib/                    # config, supabase client, notifications, OTA updates
  theme.ts                # colour tokens (same keys as Kanvas, N&N values)
assets/                   # NN logo icon + splash
app.json / eas.json       # app config, build profiles + update channels
```

## One-time setup (≈20 minutes, on your computer)

You need: Node 20+, an [Expo account](https://expo.dev/signup) (free), and an
[Apple Developer Program](https://developer.apple.com/programs/) membership.

```bash
cd mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest init              # creates the EAS project, adds projectId + owner to app.json
npx eas-cli@latest update:configure  # adds updates.url to app.json
```

Commit the `app.json` changes those commands make.

Add the Supabase keys (same values as the website's `NEXT_PUBLIC_SUPABASE_*`)
as EAS environment variables so builds *and* OTA updates get them:

```bash
for ENV in development preview production; do
  npx eas-cli@latest env:create --environment $ENV --visibility plaintext \
    --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co
  npx eas-cli@latest env:create --environment $ENV --visibility plaintext \
    --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-ANON-KEY
done
```

For local dev, copy `.env.example` to `.env.local` and fill it in.

## TestFlight

```bash
npm run testflight
```

This runs `eas build --profile production --platform ios --auto-submit`. The
first time, it asks you to sign in with your Apple ID and offers to create the
signing certificate, provisioning profile and App Store Connect app record.
Say yes to each. The build runs in the cloud (~15 min), then uploads to
App Store Connect. Apple processes it (~10–30 min) and emails you.

Then in [App Store Connect](https://appstoreconnect.apple.com) → your app →
**TestFlight** → **Internal Testing**, add yourself (and anyone on your team),
and install via the TestFlight app on your iPhone. Internal testers need no
Apple review. External testers (e.g. clients) need a quick beta review first.

## Shipping updates over the air

```bash
npm run update:production -- --message "Fix booking button"
```

Installed apps download the update in the background and apply it the next
time the app is opened, or when it's backgrounded if it was already
running (see `src/lib/useOtaUpdates.ts`). The Profile screen footer shows which
update a device is running.

**What can go OTA:** anything in JS/TS, styles, images, and screens.
**What needs a new build (`npm run testflight`):** adding/removing a library
with native code, changing `app.json` native settings (permissions, icon,
bundle id), or upgrading the Expo SDK.

`runtimeVersion` uses the **fingerprint** policy, so EAS works this out for
you. An update only ever reaches builds with matching native code, so an update
can't crash an older build that lacks a native module.

Channels: `production` (TestFlight/App Store builds), `preview` (internal
ad-hoc builds), `development` (dev client).

## Day-to-day development

```bash
npm run build:dev   # once (and after adding native libraries): dev-client build for your phone
npm start           # then open the dev build and scan the QR code
npm run typecheck
```

Expo Go won't work for everything because the app uses native modules outside
Expo Go. Use the dev build.
