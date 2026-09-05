import { json } from './_lib/http.js';
import { getState } from './_lib/store.js';
import { nextSlot } from './_lib/defaults.js';

/* Public read of the whole tournament. The page polls this. */
export default async function handler(req, res) {
  const state = await getState();
  json(res, 200, { ...state, next: nextSlot(state) });
}
