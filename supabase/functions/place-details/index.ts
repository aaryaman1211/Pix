// Full details for one place, fetched only when someone opens it. Body: { placeId }
import { placeDetails } from '../_shared/google.ts';
import { json, serve, userClient } from '../_shared/http.ts';

serve(async (req) => {
  const { data: auth } = await userClient(req).auth.getUser();
  if (!auth.user) return json({ error: 'Not signed in' }, 401);

  const { placeId } = await req.json();
  if (typeof placeId !== 'string' || !placeId) return json({ error: 'placeId is required' }, 400);

  return json(await placeDetails(placeId));
});
