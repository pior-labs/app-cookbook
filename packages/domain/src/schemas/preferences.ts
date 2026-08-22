import { z } from 'zod';
import { ratingSchema } from './primitives.js';

// A per-user 1-5 rating. Favoriting and view-recording carry no body, so they
// need no schema; the acting user always comes from the authenticated session.
export const setRatingSchema = z.object({ rating: ratingSchema }).strict();

export type SetRatingInput = z.infer<typeof setRatingSchema>;
