# Pix

A shared app for couples and friend groups: keep a list of places you want to go, get recommendations
based on it, save photos and notes from each outing, and never miss an important date.

```
mobile/     Expo (React Native) app for iOS and Android
supabase/   Database schema, row level security, storage, and edge functions
```

## How it fits together

- **Groups** own everything. A person can be in any number of groups (a couple, a friend group, …).
  Join with a 6-letter invite code. Access is enforced in Postgres with row level security
  (`is_group_member()`), so the app can talk to Supabase directly.
- **Places** come from the Google Places API (New). The API key only lives in the edge functions
  (`places-search`, `recommend`), never in the app. We store the Google `place_id` plus a display
  snapshot (name, address, type, price).
- **Memories** are any date or outing, optionally linked to a saved place. Photos are compressed on the
  phone (max 1600px wide, JPEG 70%) and uploaded to a private storage bucket so the whole group can see
  them. Originals stay in the uploader's camera roll.
- **Important dates** schedule local notifications on every member's phone (the day before and on the
  day), rebuilt whenever the Dates tab loads.
- **Recommendations** (`supabase/functions/_shared/scoring.ts`): candidate places come from Google
  nearby search inside the group's radius. Each is scored against the group's taste, built from saves,
  visits, star ratings and skips. The score combines cuisine similarity, price fit, distance and Google
  rating, with hand-set weights in `WEIGHTS`.
- **Interaction log** (`public.interactions`): every place shown, viewed, saved, skipped, visited or rated
  is recorded with its features. This is the training data for replacing `WEIGHTS` with a learned
  model once there's enough usage.

## Running the app

1. Create `mobile/.env.local`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
   ```
2. Install and run a development build (Expo Go can't load all the native modules used here):
   ```
   cd mobile
   npm install
   npx expo run:ios       # or: npx expo run:android
   ```

## Deploying the backend

```
supabase link --project-ref <project-ref>
supabase db push                                         # apply migrations
supabase secrets set GOOGLE_PLACES_API_KEY=<key>         # server-side only
supabase functions deploy places-search
supabase functions deploy recommend
```

In the Google Cloud console, enable **Places API (New)** for the key, and restrict the key to that API.

## Tests

```
node --test supabase/functions/_shared/scoring.test.ts   # recommender
cd mobile && npx tsc --noEmit && npx expo lint           # app
```

## Known limits / next steps

- Google's terms limit how long place details may be cached; only `place_id` may be kept
  indefinitely. Add a periodic job that refreshes the snapshot fields (or drops them) before launch.
- Each Discover refresh makes up to 3 Google nearby searches. Cache results per group + area to control cost.
- Swapping in a trained model: export `public.interactions`, train a ranker on the same features,
  and replace `WEIGHTS` in `scoring.ts` (or call the model from `recommend`).
