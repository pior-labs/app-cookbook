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
// Recipe mutations remain excluded. MCP v2 adds only the planning/list writes
// authorized by ADR 0008; recipe, rating and favorite mutation are not exposed.

export {
  searchRecipes,
  recentlyViewed,
  homeSections,
} from './discovery.js';

export { getRecipe } from './recipes.js';

export { listCategories, listTags } from './organization.js';

export { resolveUserByEmail, type HouseholdUser } from './identity.js';
export {
  createMealPlan, getMealPlan, listMealPlans, addRecipeToMealPlan, updateMealPlanItem,
  removeRecipeFromMealPlan, applyMealProposal, generateGroceryList, getGroceryList,
  addGroceryListItem, updateGroceryListItem, checkGroceryListItem, removeGroceryListItem,
  resolveGroceryMerge,
} from './planning.js';
