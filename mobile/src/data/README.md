# App data layer

The app is the long-term home for members' features: community, homework,
schedule, chat and profile, plus the trainer side of each. The website will
drop them once the app is live.

Each folder has `types.ts` and a `sample.ts`, originally ported from the
website's `lib/*` scaffold. `index.ts` holds the async functions screens call.

- **Live on Supabase today:** auth, `profiles` (role), `dogs` (see `dogs.ts`).
- **Sample data behind `TODO(backend)`:** community, report cards/homework,
  drill library, schedule, chat, notifications.

To go live, create the table (schema notes are in each `TODO(backend)` comment
and the website's `lib/inbox/schema.sql`), then replace that function's body
with a Supabase query. Screens don't change.
