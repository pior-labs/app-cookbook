import { Hono } from 'hono';
import type { AppEnv } from '../middleware/context.js';
import { homeSections } from '../services/discovery.js';

// The home screen's discovery sections in one response, so the screen renders
// in a single round trip instead of five (technical design section 7.2).

export const homeRoute = new Hono<AppEnv>();

homeRoute.get('/', async (c) => c.json(await homeSections(c.get('userId'))));
