import { listRecipesQuerySchema } from '@cookbook/domain';
import { Hono } from 'hono';
import type { AppEnv } from '../middleware/context.js';
import { homeSections, recentlyViewed } from '../services/discovery.js';
import { parseQuery } from './http.js';

// The two discovery reads that are not browse: the home screen's sections, and
// the acting user's own recent history (technical design sections 7.2 and
// 11.1).

export const homeRoute = new Hono<AppEnv>();

// The whole home screen in one round trip instead of five.
homeRoute.get('/', async (c) => c.json(await homeSections(c.get('userId'))));

export const recentRoute = new Hono<AppEnv>();

// Recent history is inherently ordered by view time and inherently bounded to
// what one person opened lately, so it takes a limit but no cursor: paging
// through your own recent history is not a thing a cook does.
const recentQuerySchema = listRecipesQuerySchema.pick({ limit: true });

recentRoute.get('/', async (c) =>
  c.json(await recentlyViewed(c.get('userId'), parseQuery(c, recentQuerySchema).limit)),
);
