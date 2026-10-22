# Pix — full project context

This file is the handover for anyone (human or AI assistant) picking up the Pix project. It covers what the
app is for, every decision made so far and why, how the code is organised, what is deployed, and what is
left to do. Read it top to bottom before changing anything.

Last updated: 22 Oct 2026. Repo: https://github.com/aaryaman1211/Pix (branch `main`).
Owner: Aaryaman (GitHub `aaryaman1211`).

---

## 1. What Pix is

A mobile app for **couples and friend groups** to:

1. **Keep a shared list of places they want to go** in their city (restaurant-first, but any place is allowed).
2. **Get recommendations** for more places, based on what the group saves, visits, rates and skips.
3. **Store photos and memories** from each outing in one shared folder.
4. **Keep track of important dates** (anniversaries, birthdays, "the day we met") with reminders.

The core loop the product is built around: **want to go → go → remember it → get ideas for next time.**
A visited place turns into a memory, and that history feeds the recommendations.

## 2. Product decisions (agreed with the owner)

| Question | Decision |
|---|---|
| Who is in a group? | 2 people **or** more. A person can be in **several groups** (e.g. partner + college friends) or just one. |
| Place data | **Google Places API (New)**, searched within a **radius** the group chooses (1/3/5/10/25 km). |
| Place types | **Any place**, but **restaurant-focused** for now (Discover searches restaurants by default). |
| Recommendations | "Medium": our **own model**, built in stages (see §7). Log every interaction from day one so a real model can be trained later. |
| Memories | **Any date/outing**, optionally linked to a saved place (not restaurant-only). |
| Platforms | **iOS and Android** (owner has an Apple Developer account). Built with Expo / React Native. Web runs for dev only. |
| Photos | **Hybrid**: originals stay in the phone's camera roll; a **compressed copy** (max 1600 px wide, JPEG 70%) is uploaded so the whole group can see it. Pure "point at the camera roll" was rejected because other members' phones can't see your camera roll. |
| Backend | **Supabase** (Postgres + auth + storage + edge functions). |

## 3. Tech stack

- **App**: Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6, Expo Router (file-based routes in
  `mobile/src/app`), React Compiler enabled, `NativeTabs` for the tab bar.
- **Libraries**: `@supabase/supabase-js`, AsyncStorage (session storage), `expo-image`, `expo-image-picker`,
  `expo-image-manipulator` (compression), `expo-location`, `expo-notifications` (local reminders),
  `@react-native-community/datetimepicker`, `expo-crypto` (UUIDs for photo file names).
- **Backend**: Supabase cloud project **`pix`**, ref `qcpactekxpufewanpenh`, region South Asia (Mumbai),
  URL `https://qcpactekxpufewanpenh.supabase.co`.
- **Edge functions**: Deno (Supabase Edge Runtime), `npm:@supabase/supabase-js@2`.

> Expo changes a lot between SDKs. `mobile/AGENTS.md` says: check the versioned docs for SDK 58
> (https://docs.expo.dev/versions/v58.0.0/) before using any Expo API, and install packages with
> `npx expo install`, never plain `npm install <pkg>`.

## 4. Repository layout

```
CONTEXT.md                     ← this file
README.md                      short setup/deploy guide
.claude/launch.json            dev-server config for Claude Code's preview (Expo web on :8081)

mobile/                        Expo app
  app.json                     name "Pix", scheme "pix", bundle/package id com.aaryaman.pix, permission strings
  .env.local                   (gitignored) EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
  src/app/                     ROUTES (every file is a screen)
    _layout.tsx                providers + root Stack with auth/group guards (Stack.Protected)
    sign-in.tsx                email+password sign in / create account
    onboarding.tsx             shown when signed in but in no group: create or join
    groups.tsx                 modal: switch group, invite code + share, members, radius, create/join another, leave, sign out
    (tabs)/_layout.tsx         NativeTabs: Places, Discover, Memories, Dates
    (tabs)/index.tsx           Places: "Want to go" / "Been" lists
    (tabs)/discover.tsx        recommendations with Save / Skip
    (tabs)/memories.tsx        memory cards with cover photo + "On this day"
    (tabs)/dates.tsx           important dates sorted by next occurrence, with countdowns
    search.tsx                 modal: Google text search near you, Add to list
    place/[id].tsx             saved place: ratings per member, memories here, map link, mark visited, remove
    memory/new.tsx             modal: title, date, optional place, notes, photos
    memory/[id].tsx            memory detail: photo grid, full-screen viewer, add photos, delete
    date/new.tsx               modal: add important date (yearly or one-off)
  src/components/
    ui.tsx                     shared UI kit: TabHeader, Button, AddButton, Input, Card, Segmented, Chip, Stars, Empty, ErrorText, Loading
    themed-text.tsx / themed-view.tsx   (from Expo template) theme-aware Text/View
    create-or-join.tsx         create group / join by code (used by onboarding + groups)
    date-field.tsx             date picker (iOS compact, Android dialog, web text input)
    photo-picker-strip.tsx     picked-photo previews before upload
    place-row.tsx              list row for a place
  src/lib/
    supabase.ts                Supabase client (AsyncStorage session, auto-refresh only in foreground)
    auth.tsx                   AuthProvider / useAuth / useUserId
    groups.tsx                 GroupProvider: user's groups, active group (persisted), refresh
    use-query.ts               tiny data loader: refetches on screen focus; `must()` unwraps Supabase results
    types.ts                   hand-written row types + PlaceResult / Recommendation
    functions.ts               invoke() wrapper for edge functions with proper error messages
    places.ts                  addPlace() (dedupes on unique key), Google Maps URL
    photos.ts                  pick → compress → upload to storage → insert memory_photos; signed URLs; delete
    interactions.ts            logInteraction() → public.interactions (fire-and-forget)
    reminders.ts               schedules local notifications for all dates across the user's groups
    location.ts                useLocation() (foreground permission, last known or current position)
    format.ts                  labels, YYYY-MM-DD parsing (local time), next-occurrence maths
    geo.ts                     haversine distance (same as the server's)
  src/constants/theme.ts       colours (warm light/dark palette, accent #E5484D), spacing

supabase/
  config.toml                  CLI config (local dev settings; cloud project is linked separately)
  migrations/
    20261022000000_init.sql            full schema, RLS, RPCs, storage bucket + policies
    20261022010000_ensure_profiles.sql backfills missing profiles; create/join group now ensure a profile exists
  functions/
    _shared/scoring.ts         the recommender (pure TS, runs in Deno and Node)
    _shared/scoring.test.ts    6 unit tests (node --test)
    _shared/google.ts          Google Places API (New) calls: searchText, searchNearby
    _shared/http.ts            JSON/CORS helpers, user-scoped Supabase client, error handling
    places-search/index.ts     POST { query, lat, lng, radiusM } → { results }
    recommend/index.ts         POST { groupId, lat, lng } → { results, topTypes }
    .env.example               GOOGLE_PLACES_API_KEY= (for local function dev only)
```

## 5. Data model (Postgres, `public` schema)

Everything except `profiles` belongs to a **group**. Access is enforced by **row level security** using
`is_group_member(group_id)` (a `security definer` function, so policies don't recurse).

| Table | Purpose / key columns |
|---|---|
| `profiles` | one per auth user: `id` (= auth.users.id), `display_name`. Created by trigger `on_auth_user_created`. |
| `groups` | `name`, `invite_code` (6 chars, unique), `search_radius_m` (500–50000, default 5000), `created_by`. |
| `group_members` | (`group_id`, `user_id` → profiles), `role` owner/member. |
| `saved_places` | the wishlist: Google `place_id` + display snapshot (`name`, `address`, `primary_type`, `types[]`, `price_level` 0–4, `lat`, `lng`), `status` want/visited, `added_by`. Unique (`group_id`, `place_id`). |
| `memories` | `title`, `happened_on` (date), `notes`, optional `place_id` + `place_name`, `created_by`. |
| `memory_photos` | `memory_id`, `group_id`, `storage_path`, `width`, `height`, `local_asset_id` (uploader's camera-roll id, for a future "open original"), `uploaded_by`. |
| `ratings` | one per (`group_id`, `user_id`, `place_id`), `score` 1–5. |
| `important_dates` | `title`, `date`, `repeats_yearly`. |
| `interactions` | training log: `action` (shown/view/save/unsave/dismiss/visit/rate), `source` (search/recommend/list), `value`, plus place features copied in (`place_types[]`, `price_level`, `google_rating`, `distance_m`). |

**RPCs** (call with `supabase.rpc`): `create_group(group_name)` and `join_group(code)`. Both are
`security definer` because a user can't insert a membership for a group they're not yet in.

**Storage**: private bucket `memory-photos` (JPEG only, 5 MB max). Object path is
`{group_id}/{memory_id}/{uuid}.jpg`; storage policies check `is_group_member` on the first path segment.
The app displays photos via **signed URLs** (1 hour) with `expo-image` `cacheKey = storage_path`.

## 6. How the app flows

1. **Root layout** (`src/app/_layout.tsx`) waits for the session and groups, then uses `Stack.Protected`
   guards: signed out → `sign-in`; signed in with no group → `onboarding`; otherwise the tabs and modals.
2. **Active group** is stored in AsyncStorage (`pix.activeGroupId`); the group name at the top of each tab
   opens `groups.tsx` to switch.
3. **Screens fetch directly from Supabase** with `useQuery`, which refetches whenever the screen gets focus,
   so lists update after editing on another screen. There's no realtime subscription yet (pull to refresh).
4. **Adding a memory from a "want" place** marks it `visited` and logs a `visit` interaction.
5. **Reminders**: `syncReminders()` cancels Pix's scheduled notifications and reschedules the next 30 dates
   across all the user's groups (iOS caps pending local notifications at 64), on the day and the day before,
   at 09:00. It runs when the Dates tab loads and after adding a date.

## 7. Recommendations

Built in stages so it can grow into a trained model **without changing callers**:

- **Stage 1–2 (built, live)**: `supabase/functions/_shared/scoring.ts`.
  - The group's **taste** is a weighted sum over its signals: saved place +1.0, visited +1.5, rating
    (score − 3) × 1.0, skipped −1.0. It's a vector over specific Google types (generic types like
    `restaurant`, `food`, `point_of_interest` are ignored) plus a weighted average price preference.
  - Each candidate scores
    `3.0·cuisineSimilarity + 1.0·priceMatch + 1.0·closeness + 1.5·ratingScore` (weights in `WEIGHTS`).
    Cuisine similarity is cosine similarity of type vectors; rating is adjusted for review count.
  - Every result gets a human reason ("You like thai places", "Highly rated (4.6★)", "Popular nearby").
- **Candidates** (`recommend/index.ts`): up to 3 Google nearby searches (popular `restaurant`, plus the
  group's top 2 types), within the group's radius, excluding places already saved or skipped. The top 15
  are returned, and each is logged as a `shown` interaction (the negatives/positives for training).
- **Stage 3 (future)**: once there are a few thousand interactions, export `public.interactions`, train a
  ranker (e.g. gradient-boosted trees) on the same features, and replace `WEIGHTS` or call the model
  from `recommend`. "Groups like yours also liked…" (collaborative filtering) also needs that volume.
- Tests: `node --test supabase/functions/_shared/scoring.test.ts` (6 passing).

## 8. Google Places — what's needed (this is the open item)

The Google API key **only lives on the server** as a Supabase secret. The app never sees it.

**Calls made** (Places API **New**, `places.googleapis.com/v1`):
- `places:searchText`: user search, location-biased to the group's radius, 20 results.
- `places:searchNearby`: Discover candidates, `rankPreference: POPULARITY`, 20 results, up to 3 per refresh.
- Field mask: `id, displayName, formattedAddress, location, types, primaryType, priceLevel, rating, userRatingCount`.
  `rating`/`priceLevel` put requests in Google's top (Enterprise) pricing tier, which has the smallest free
  monthly allowance (about 1,000 calls/month at time of writing; check current pricing). Dropping those two
  fields would move it to a cheaper tier with a bigger free allowance, but recommendations would lose price
  matching and the rating signal.
- No Place Photos calls (to save cost); place rows show text only.

**Setup steps:**
1. Google Cloud console → create or choose a project → **enable "Places API (New)"** (not the legacy
   "Places API"). A billing account is required even for the free tier. **Set a budget alert** (e.g. $1–5).
2. **APIs & Services → Credentials → Create credentials → API key.** Restrict it: API restriction =
   *Places API (New)* only. No application restriction is needed because it's only used server-side.
3. Store it as a Supabase secret, run from the repo root by someone with access to the Supabase project:
   ```
   supabase secrets set GOOGLE_PLACES_API_KEY=<key>
   ```
   No redeploy is needed; functions read it at request time.
4. **Never commit the key** or paste it into chats, issues or the app. If it leaks, delete it in Google
   Cloud and make a new one.

**How a friend can provide it without sharing the raw key around:** the cleanest way is for the friend to
create the Google Cloud project and **add Aaryaman as a project member** (IAM, e.g. "Editor"), so the owner
can create and manage the key directly. Otherwise, hand the key over privately (password manager share) and
have the owner run step 3.

**Free alternatives considered** (not built): Geoapify / OpenStreetMap (free, no card, but no ratings or price
levels and patchier coverage) and Foursquare. All Google-specific code is in `supabase/functions/_shared/google.ts`,
so switching providers, or a hybrid (OpenStreetMap for Discover, Google for typed search), is contained.

## 9. Current status (22 Oct 2026)

**Done**
- Whole app written: auth, groups/invites, places + search, place detail + ratings, Discover, memories
  with photo upload, dates with reminders.
- `npx tsc --noEmit` is clean apart from one template error about `@/global.css`, which disappears once
  `expo start` has generated `expo-env.d.ts`.
- Recommender unit tests pass.
- Supabase `pix` project: **both migrations pushed**, **both edge functions deployed**
  (`supabase functions deploy places-search recommend --use-api`).
- Code pushed to GitHub `main` (initial commit `0b9cf09`). `CONTEXT.md` was written after that commit.
- Expo web dev server runs (`cd mobile && npx expo start --web --port 8081`) and the sign-in screen renders
  with no console errors.

**Not done / not verified yet**
- **Google API key not set**: search and Discover return "GOOGLE_PLACES_API_KEY is not set".
- **Not run on a phone yet.** Native builds need `npx expo run:ios` / `run:android` (a dev build; Expo Go
  can't be relied on for all modules). Beyond the sign-in screen rendering on web, nothing has been
  tested end-to-end yet, including group creation after the profile fix.
- `npx expo lint` hasn't been run (ESLint isn't installed yet).
- No automated UI tests.
- App icon and splash are still Expo's defaults.
- Email confirmation is probably **on** in the cloud project's auth settings (Supabase's default; not checked). Sign-up then shows
  "check your email". Turn it off in the dashboard (Authentication → Providers → Email) for easier testing
  if wanted.

## 10. Running and deploying

```bash
# app (from repo root)
cd mobile
npm install                      # or npm ci
# create mobile/.env.local with:
#   EXPO_PUBLIC_SUPABASE_URL=https://qcpactekxpufewanpenh.supabase.co
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key from Supabase dashboard → Project Settings → API>
npx expo start --web             # quick web check
npx expo run:ios                 # native dev build on the iOS simulator
npx tsc --noEmit                 # typecheck

# backend (from repo root; needs `supabase login` and `supabase link --project-ref qcpactekxpufewanpenh`)
supabase db push                                   # apply new migrations (asks for the DB password)
supabase functions deploy places-search recommend --use-api
supabase secrets set GOOGLE_PLACES_API_KEY=<key>
node --test supabase/functions/_shared/scoring.test.ts
```

Schema changes always go in a **new** migration file in `supabase/migrations/`. Never edit a migration that
has already been pushed.

## 11. Gotchas learned the hard way

- **Don't keep the repo in iCloud-synced folders** (`~/Documents`, `~/Desktop` with iCloud Desktop &
  Documents on). macOS offloaded `node_modules` to iCloud when the disk was full, and every read then waited
  on a download, so Expo and `tsc` crawled at 0% CPU. The project now lives in `~/Developer/Pix`.
- **Docker / local Supabase**: `supabase start` downloads many GB of images. On this Mac it filled the disk,
  so development uses the **cloud** project instead. Functions deploy with `--use-api` (no Docker needed).
- **Profiles for pre-existing users**: accounts created before the schema existed had no `profiles` row,
  which broke the `group_members → profiles` foreign key. Migration `20261022010000_ensure_profiles.sql`
  backfills them, and `create_group` / `join_group` now call `ensure_profile()`.
- **Dates** are stored as `YYYY-MM-DD` and must be parsed as **local** dates (`parseDay` in `format.ts`),
  not with `new Date('YYYY-MM-DD')`, which is UTC and shifts the day in some timezones.
- **Yearly notification triggers** use JavaScript month numbering (January = 0).
- **Google caching terms**: only `place_id` may be stored indefinitely; the other place fields we store are a
  display snapshot and should get a periodic refresh job before launch.

## 12. Next steps (suggested order)

1. Set the Google API key (§8), then test search → add → Discover end-to-end.
2. Run on the iOS simulator (`npx expo run:ios`), then Android; fix anything platform-specific.
3. Install ESLint (`npx expo lint`) and fix warnings.
4. App icon, splash screen, store listing basics; decide on the final bundle id before the first store
   upload (currently `com.aaryaman.pix`; it can't change after publishing).
5. Cache Google results per group + area to cut cost; add the place-snapshot refresh job.
6. Realtime updates (Supabase Realtime) so a partner's changes appear without pull-to-refresh.
7. Later: camera capture inside the app, "open original" from the uploader's camera roll, map view,
   "where should we go tonight?" picker, LLM-written recommendation reasons, trained ranker (Stage 3).

## 13. Secrets and access (never commit these)

| Secret | Where it lives |
|---|---|
| Supabase publishable (anon) key | `mobile/.env.local` (gitignored). Safe to ship in the app; RLS protects data. |
| Supabase service-role / secret key | Supabase dashboard only. **Never** put it in the app or the repo. |
| Supabase database password | The owner's password manager. Needed for `supabase db push` / `link`. |
| Google Places API key | Supabase secret `GOOGLE_PLACES_API_KEY` only. |

To work on the backend, a collaborator needs to be invited to the Supabase organisation (dashboard →
Organization → Team) or have the owner run the deploy commands.
