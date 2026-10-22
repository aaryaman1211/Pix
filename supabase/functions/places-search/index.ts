// Search Google Places around the user. Body: { query, lat, lng, radiusM }
import { searchText } from '../_shared/google.ts';
import { json, serve, userClient } from '../_shared/http.ts';

serve(async (req) => {
  const { data: auth } = await userClient(req).auth.getUser();
  if (!auth.user) return json({ error: 'Not signed in' }, 401);

  const { query, lat, lng, radiusM } = await req.json();
  if (typeof query !== 'string' || !query.trim()) return json({ error: 'query is required' }, 400);
  if (typeof lat !== 'number' || typeof lng !== 'number') return json({ error: 'lat and lng are required' }, 400);

  const results = await searchText(query.trim(), lat, lng, radiusM ?? 5000);
  return json({ results });
});
