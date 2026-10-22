// Run with: node --test supabase/functions/_shared/scoring.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildTaste, scoreCandidates, topTypes, typeSimilarity, type Candidate } from './scoring.ts';

const origin = { lat: 40.73, lng: -73.99 };

function place(id: string, types: string[], extra: Partial<Candidate> = {}): Candidate {
  return { placeId: id, name: id, lat: origin.lat, lng: origin.lng, types, ...extra };
}

test('generic types do not count as taste', () => {
  const taste = buildTaste([{ types: ['restaurant', 'food', 'thai_restaurant'], weight: 1 }]);
  assert.deepEqual([...taste.types.keys()], ['thai_restaurant']);
});

test('places matching saved cuisines rank above others', () => {
  const taste = buildTaste([
    { types: ['thai_restaurant', 'restaurant'], weight: 1 },
    { types: ['thai_restaurant'], weight: 1.5 },
    { types: ['pizza_restaurant'], weight: -1 },
  ]);
  const ranked = scoreCandidates(
    taste,
    [place('pizza', ['pizza_restaurant']), place('thai', ['thai_restaurant']), place('cafe', ['cafe'])],
    origin,
    5000,
  );
  assert.equal(ranked[0].placeId, 'thai');
  assert.equal(ranked[0].reason, 'You like thai places');
  assert.equal(ranked.at(-1)?.placeId, 'pizza');
});

test('dismissed cuisines get negative similarity', () => {
  const taste = buildTaste([{ types: ['sushi_restaurant'], weight: -1 }]);
  assert.ok(typeSimilarity(taste, ['sushi_restaurant']) < 0);
});

test('closer and better rated wins when taste is empty', () => {
  const taste = buildTaste([]);
  const far = place('far', ['cafe'], { lat: origin.lat + 0.03, rating: 4.0, ratingCount: 50 });
  const near = place('near', ['cafe'], { rating: 4.7, ratingCount: 2000 });
  const ranked = scoreCandidates(taste, [far, near], origin, 5000);
  assert.equal(ranked[0].placeId, 'near');
});

test('price preference favours similar price levels', () => {
  const taste = buildTaste([{ types: ['cafe'], priceLevel: 1, weight: 1 }]);
  const ranked = scoreCandidates(
    taste,
    [place('fancy', ['cafe'], { priceLevel: 4 }), place('cheap', ['cafe'], { priceLevel: 1 })],
    origin,
    5000,
  );
  assert.equal(ranked[0].placeId, 'cheap');
});

test('topTypes returns liked types only, most liked first', () => {
  const taste = buildTaste([
    { types: ['thai_restaurant'], weight: 2 },
    { types: ['ramen_restaurant'], weight: 1 },
    { types: ['pizza_restaurant'], weight: -1 },
  ]);
  assert.deepEqual(topTypes(taste, 5), ['thai_restaurant', 'ramen_restaurant']);
});
