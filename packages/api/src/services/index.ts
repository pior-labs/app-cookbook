// The application service surface that trusted in-process consumers may call.
//
// Routes reach for the individual modules directly; this barrel exists so that
// a consumer outside the HTTP boundary - the MCP server (ADR 0006) - has one
// reviewable list of what it is allowed to use, instead of importing into the
// middle of the package. Anything absent here is deliberately not part of that
// contract: the image pipeline, route handlers, and middleware are not.
//
// Every per-user service takes an explicit `userId`. There is no ambient
// session at this layer, which is what lets a non-HTTP caller act as a
// specific household member without inventing a second authentication path.
//
// Note what is missing: every mutation. MCP v1 is read-only (ADR 0006), and
// re-exporting only readers makes that structural rather than a promise kept by
// each tool definition - a write tool added by mistake would fail to resolve
// its import rather than reach the household's recipes.

export {
  searchRecipes,
  recentlyViewed,
  homeSections,
} from './discovery.js';

export { getRecipe } from './recipes.js';

export { listCategories, listTags } from './organization.js';

export { resolveUserByEmail, type HouseholdUser } from './identity.js';
