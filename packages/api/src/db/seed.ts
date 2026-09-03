import { createRecipeSchema } from '@cookbook/domain';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { closeDatabase, db } from './index.js';
import { recipes, users } from './schema.js';
import { replaceRecipePhoto } from '../services/images.js';
import { listCategories, listTags, createTag } from '../services/organization.js';
import { favoriteRecipe, rateRecipe, recordView } from '../services/preferences.js';
import { createRecipe } from '../services/recipes.js';
import { moveRecipeToTrash } from '../services/trash.js';

// Development seed: a household cookbook with enough real content to judge the
// product on. It goes through the same services the API routes do, so every
// recipe is written in one transaction, every quantity is parsed into the exact
// fractions the domain works in, and every photo runs through the real image
// pipeline rather than having storage keys invented for it.
//
// It only ever adds. A recipe whose name is already present is skipped, so
// running this twice does not produce two of everything and never touches work
// done in the app by hand.

// Each seeded tag carries a colour from the palette, so a fresh database shows
// what a coloured tag looks like rather than leaving the feature invisible
// until someone sets one.
const TAGS = [
  { name: 'Weeknight', color: '#6b8db5' },
  { name: 'Vegetarian', color: '#5b8a5a' },
  { name: 'Make ahead', color: '#a87cc4' },
  { name: 'Comfort', color: '#c96442' },
  { name: 'Crowd pleaser', color: '#e2738a' },
  { name: 'One pot', color: '#d4a55a' },
  { name: 'Freezer friendly', color: '#7ec1c1' },
] as const;

interface SeedRecipe {
  name: string;
  category: string;
  description: string;
  baseServings: number;
  prepMinutes: number;
  cookMinutes: number;
  notes?: string;
  tags: string[];
  // Dish, rim, and board tones for the generated photograph.
  colors: [string, string, string];
  ingredients: {
    name: string;
    quantity?: string;
    unitCode?: string;
    unitText?: string;
    preparation?: string;
  }[];
  instructions: string[];
}

const RECIPES: SeedRecipe[] = [
  {
    name: 'Lemon Ricotta Pancakes',
    category: 'Breakfast',
    description: 'Feather-light from whipped whites, tangy from ricotta and a lot of zest.',
    baseServings: 4,
    prepMinutes: 20,
    cookMinutes: 15,
    colors: ['#f4c76a', '#d99a3e', '#3a2a1e'],
    tags: ['Vegetarian', 'Crowd pleaser'],
    notes: 'The batter thickens as it sits. Loosen with a splash of milk for the second batch.',
    ingredients: [
      { name: 'whole-milk ricotta', quantity: '1', unitCode: 'cup' },
      { name: 'all-purpose flour', quantity: '3/4', unitCode: 'cup' },
      { name: 'eggs', quantity: '3', unitText: 'large', preparation: 'separated' },
      { name: 'lemon', quantity: '1', unitText: 'whole', preparation: 'zested and juiced' },
      { name: 'granulated sugar', quantity: '2', unitCode: 'tbsp' },
      { name: 'baking powder', quantity: '1', unitCode: 'tsp' },
      {
        name: 'butter',
        quantity: '2',
        unitCode: 'tbsp',
        preparation: 'melted, plus more for the pan',
      },
      { name: 'kosher salt' },
    ],
    instructions: [
      'Whisk the ricotta, yolks, lemon zest and juice, sugar, and melted butter until smooth.',
      'Fold in the flour, baking powder, and a good pinch of salt. Stop while it still looks shaggy.',
      'Beat the whites to soft peaks, then fold them in in two additions. Keep the air.',
      'Cook in butter over medium-low, about 3 minutes a side. They brown faster than they look.',
      'Serve straight from the pan with more lemon and a drift of powdered sugar.',
    ],
  },
  {
    name: 'Shakshuka with Feta',
    category: 'Breakfast',
    description: 'Eggs poached into a smoky pepper and tomato base, finished with brine and herbs.',
    baseServings: 4,
    prepMinutes: 15,
    cookMinutes: 30,
    colors: ['#e2603c', '#a83a22', '#2e2018'],
    tags: ['Vegetarian', 'One pot', 'Weeknight'],
    ingredients: [
      { name: 'olive oil', quantity: '3', unitCode: 'tbsp' },
      { name: 'yellow onion', quantity: '1', unitText: 'large', preparation: 'sliced thin' },
      { name: 'red bell peppers', quantity: '2', preparation: 'sliced' },
      { name: 'garlic cloves', quantity: '4', preparation: 'sliced' },
      { name: 'smoked paprika', quantity: '2', unitCode: 'tsp' },
      { name: 'ground cumin', quantity: '1', unitCode: 'tsp' },
      { name: 'crushed tomatoes', quantity: '28', unitCode: 'oz' },
      { name: 'eggs', quantity: '6' },
      { name: 'feta', quantity: '4', unitCode: 'oz', preparation: 'crumbled' },
      { name: 'cilantro', quantity: '1/2', unitCode: 'cup', preparation: 'roughly chopped' },
    ],
    instructions: [
      'Soften the onion and peppers in the oil over medium heat, 12 minutes, until sweet.',
      'Add the garlic and spices and stir for a minute, until the pan smells toasted rather than raw.',
      'Pour in the tomatoes, season, and simmer 10 minutes until it mounds on the spoon.',
      'Make six wells and crack in the eggs. Cover and cook 6 to 8 minutes for set whites and loose yolks.',
      'Scatter the feta and cilantro over the top and bring the pan to the table.',
    ],
  },
  {
    name: 'Cacio e Pepe',
    category: 'Dinner',
    description: 'Four ingredients and no room to hide. The starch water does all the work.',
    baseServings: 2,
    prepMinutes: 5,
    cookMinutes: 15,
    colors: ['#e8dcc0', '#c4b087', '#241c15'],
    tags: ['Vegetarian', 'Weeknight'],
    notes: 'Pull the pan off the heat before the cheese goes in. Direct heat is what makes it clump.',
    ingredients: [
      { name: 'tonnarelli or spaghetti', quantity: '200', unitCode: 'g' },
      { name: 'pecorino romano', quantity: '100', unitCode: 'g', preparation: 'finely grated' },
      { name: 'black peppercorns', quantity: '2', unitCode: 'tsp', preparation: 'coarsely cracked' },
      { name: 'kosher salt' },
    ],
    instructions: [
      'Boil the pasta in deliberately under-salted water: the pecorino is already salty.',
      'Toast the cracked pepper in a wide dry pan until fragrant, then add a ladle of pasta water.',
      'Drain the pasta two minutes early and finish it in the pepper water, tossing hard.',
      'Off the heat, add the pecorino in handfuls, tossing between each, loosening with more water.',
      'Serve immediately in warmed bowls. It waits for nobody.',
    ],
  },
  {
    name: 'Braised Short Ribs in Red Wine',
    category: 'Dinner',
    description:
      'Three hours mostly unattended, and the sauce comes out glossy without a single thickener.',
    baseServings: 6,
    prepMinutes: 30,
    cookMinutes: 210,
    colors: ['#8c3b22', '#5a2415', '#221812'],
    tags: ['Make ahead', 'Comfort', 'Crowd pleaser'],
    notes: 'Better on day two. Chill overnight, lift the fat cap off, and reheat gently.',
    ingredients: [
      { name: 'bone-in short ribs', quantity: '4', unitCode: 'lb' },
      { name: 'kosher salt', quantity: '2', unitCode: 'tbsp' },
      { name: 'neutral oil', quantity: '2', unitCode: 'tbsp' },
      { name: 'onions', quantity: '2', preparation: 'quartered' },
      { name: 'carrots', quantity: '3', preparation: 'cut into thirds' },
      { name: 'tomato paste', quantity: '3', unitCode: 'tbsp' },
      { name: 'dry red wine', quantity: '1', unitText: 'bottle' },
      { name: 'beef stock', quantity: '3', unitCode: 'cup' },
      { name: 'thyme', quantity: '6', unitText: 'sprigs' },
      { name: 'bay leaves', quantity: '2' },
    ],
    instructions: [
      'Salt the ribs and leave them uncovered in the fridge overnight if you can.',
      'Sear hard in the oil, in batches, until every side is properly brown. Do not crowd the pot.',
      'Brown the vegetables in the fat, add the tomato paste, and cook until it darkens to brick.',
      'Deglaze with the wine and reduce by half, scraping the bottom clean.',
      'Return the ribs, add stock to come three-quarters up, tuck in the herbs, and cover.',
      'Braise at 325F for 3 hours, until a fork meets no resistance at all.',
      'Strain the sauce, skim it, and reduce until it coats a spoon. Spoon it back over the ribs.',
    ],
  },
  {
    name: 'Weeknight Green Curry',
    category: 'Dinner',
    description: 'Bloom the paste properly and a jarred curry tastes like it took an afternoon.',
    baseServings: 4,
    prepMinutes: 15,
    cookMinutes: 20,
    colors: ['#7fa85c', '#4c7038', '#1f2418'],
    tags: ['Weeknight', 'One pot'],
    ingredients: [
      { name: 'coconut milk', quantity: '14', unitCode: 'oz', preparation: 'full fat, unshaken' },
      { name: 'green curry paste', quantity: '3', unitCode: 'tbsp' },
      { name: 'chicken thighs', quantity: '1', unitCode: 'lb', preparation: 'sliced' },
      { name: 'thai eggplant', quantity: '6', preparation: 'quartered' },
      { name: 'fish sauce', quantity: '2', unitCode: 'tbsp' },
      { name: 'palm sugar', quantity: '1', unitCode: 'tbsp' },
      { name: 'thai basil', quantity: '1', unitCode: 'cup' },
      { name: 'lime', quantity: '1' },
    ],
    instructions: [
      'Spoon the thick cream off the top of the coconut milk and fry it until the oil splits out.',
      'Add the paste and fry another 2 minutes, until it darkens and smells like a kitchen, not a jar.',
      'Add the chicken and coat, then the rest of the coconut milk and the eggplant.',
      'Simmer 12 minutes, then season with fish sauce and palm sugar until it tastes balanced.',
      'Off the heat, stir through the basil and a squeeze of lime. Serve with jasmine rice.',
    ],
  },
  {
    name: 'Roast Chicken with Bread Salad',
    category: 'Dinner',
    description: 'The bread under the bird catches every drop of fat. That is the whole point.',
    baseServings: 4,
    prepMinutes: 20,
    cookMinutes: 60,
    colors: ['#d9a154', '#a86f2c', '#291e15'],
    tags: ['Crowd pleaser', 'Comfort'],
    ingredients: [
      { name: 'whole chicken', quantity: '3 1/2', unitCode: 'lb' },
      { name: 'kosher salt', quantity: '1', unitCode: 'tbsp' },
      {
        name: 'country bread',
        quantity: '1/2',
        unitText: 'loaf',
        preparation: 'torn into large pieces',
      },
      { name: 'olive oil', quantity: '1/4', unitCode: 'cup' },
      { name: 'currants', quantity: '1/4', unitCode: 'cup' },
      { name: 'red wine vinegar', quantity: '2', unitCode: 'tbsp' },
      { name: 'scallions', quantity: '4', preparation: 'sliced' },
      { name: 'arugula', quantity: '3', unitCode: 'cup' },
    ],
    instructions: [
      'Salt the chicken a day ahead and leave it uncovered in the fridge for dry skin.',
      'Toss the bread with olive oil and toast it until the edges crisp but the middles stay soft.',
      'Soak the currants in the vinegar while everything else happens.',
      'Roast the chicken at 475F for 50 to 60 minutes, sliding the bread underneath for the last 20.',
      'Rest the bird 15 minutes, then toss the bread with the drippings, currants, scallions, and arugula.',
      'Carve over the salad so the juices land where they belong.',
    ],
  },
  {
    name: 'Miso Butter Mushroom Toast',
    category: 'Lunch',
    description: 'Ten minutes, one pan, and an unreasonable amount of savoury depth.',
    baseServings: 2,
    prepMinutes: 5,
    cookMinutes: 12,
    colors: ['#b98a4f', '#7d5a2e', '#241a13'],
    tags: ['Vegetarian', 'Weeknight'],
    ingredients: [
      { name: 'mixed mushrooms', quantity: '12', unitCode: 'oz', preparation: 'torn' },
      { name: 'butter', quantity: '3', unitCode: 'tbsp' },
      { name: 'white miso', quantity: '1', unitCode: 'tbsp' },
      { name: 'garlic clove', quantity: '1', preparation: 'grated' },
      { name: 'sourdough', quantity: '2', unitText: 'thick slices' },
      { name: 'chives', quantity: '2', unitCode: 'tbsp', preparation: 'sliced' },
    ],
    instructions: [
      'Get the pan properly hot and cook the mushrooms dry until they squeak and brown.',
      'Add the butter, garlic, and miso and toss until everything is glazed.',
      'Pile onto toast, scrape the pan out over the top, and finish with chives.',
    ],
  },
  {
    name: 'Olive Oil Orange Cake',
    category: 'Dessert',
    description: 'Whole oranges, skin and all, boiled soft and blitzed into the batter.',
    baseServings: 10,
    prepMinutes: 25,
    cookMinutes: 55,
    colors: ['#eaa444', '#c07423', '#2b1d13'],
    tags: ['Make ahead', 'Vegetarian'],
    notes: 'Keeps four days at room temperature and gets moister every one of them.',
    ingredients: [
      { name: 'oranges', quantity: '2', preparation: 'whole, boiled 1 hour' },
      { name: 'eggs', quantity: '4' },
      { name: 'granulated sugar', quantity: '1 1/4', unitCode: 'cup' },
      { name: 'almond flour', quantity: '2', unitCode: 'cup' },
      { name: 'olive oil', quantity: '1/2', unitCode: 'cup', preparation: 'good, fruity' },
      { name: 'baking powder', quantity: '1', unitCode: 'tsp' },
      { name: 'kosher salt', quantity: '1/2', unitCode: 'tsp' },
    ],
    instructions: [
      'Boil the whole oranges for an hour, changing the water once. Cool, then blitz them entirely.',
      'Whisk the eggs and sugar until pale and thick, about 4 minutes.',
      'Fold in the orange puree, olive oil, almond flour, baking powder, and salt.',
      'Bake at 350F for 50 to 55 minutes, until the centre only just stops wobbling.',
      'Cool completely in the tin. It is far too tender to move warm.',
    ],
  },
  {
    name: 'Salted Chocolate Chunk Cookies',
    category: 'Dessert',
    description: 'Rested dough, chopped chocolate rather than chips, and flaky salt on top.',
    baseServings: 18,
    prepMinutes: 20,
    cookMinutes: 12,
    colors: ['#8a5a35', '#54331d', '#221610'],
    tags: ['Freezer friendly', 'Crowd pleaser'],
    notes: 'Scoop and freeze. Bake from frozen, adding two minutes.',
    ingredients: [
      { name: 'butter', quantity: '1', unitCode: 'cup', preparation: 'browned and cooled' },
      { name: 'brown sugar', quantity: '1', unitCode: 'cup' },
      { name: 'granulated sugar', quantity: '1/2', unitCode: 'cup' },
      { name: 'eggs', quantity: '2' },
      { name: 'vanilla extract', quantity: '2', unitCode: 'tsp' },
      { name: 'all-purpose flour', quantity: '2 1/4', unitCode: 'cup' },
      { name: 'baking soda', quantity: '1', unitCode: 'tsp' },
      { name: 'dark chocolate', quantity: '8', unitCode: 'oz', preparation: 'chopped into shards' },
      { name: 'flaky sea salt' },
    ],
    instructions: [
      'Brown the butter and let it cool until it is no longer warm to the finger.',
      'Beat in both sugars, then the eggs and vanilla, until the mixture ribbons.',
      'Fold in the flour, soda, and a teaspoon of fine salt, then the chocolate.',
      'Rest the dough at least 24 hours in the fridge. Not optional if you want the flavour.',
      'Bake at 375F for 11 to 12 minutes, set at the edge and visibly underdone in the middle.',
      'Salt the tops the second they come out.',
    ],
  },
  {
    name: 'Ginger Lime Cooler',
    category: 'Drink',
    description: 'A sharp ginger syrup that keeps two weeks and rescues any glass of soda water.',
    baseServings: 8,
    prepMinutes: 10,
    cookMinutes: 15,
    colors: ['#c9d96a', '#8aa33c', '#1e2417'],
    tags: ['Make ahead', 'Vegetarian'],
    ingredients: [
      { name: 'fresh ginger', quantity: '6', unitCode: 'oz', preparation: 'sliced thin, unpeeled' },
      { name: 'granulated sugar', quantity: '1', unitCode: 'cup' },
      { name: 'water', quantity: '1', unitCode: 'cup' },
      { name: 'limes', quantity: '4', preparation: 'juiced' },
      { name: 'soda water', quantity: '1', unitCode: 'l' },
    ],
    instructions: [
      'Simmer the ginger, sugar, and water for 15 minutes, then steep off the heat for an hour.',
      'Strain, pressing hard on the solids, and stir in the lime juice.',
      'Pour an inch into a tall glass of ice and top with soda water.',
    ],
  },
];

// A plate on a board. Not a photograph, but the right value range and colour
// temperature to judge a photo-led layout honestly, and it costs no network.
function plate([dish, rim, board]: [string, string, string]): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <defs>
      <radialGradient id="d" cx="50%" cy="46%" r="52%">
        <stop offset="0%" stop-color="${dish}"/>
        <stop offset="70%" stop-color="${rim}"/>
        <stop offset="100%" stop-color="${rim}" stop-opacity="0.85"/>
      </radialGradient>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${board}"/>
        <stop offset="100%" stop-color="#2a1f18"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="900" fill="url(#bg)"/>
    <ellipse cx="600" cy="430" rx="330" ry="310" fill="#f6efe4" opacity="0.92"/>
    <ellipse cx="600" cy="424" rx="268" ry="250" fill="url(#d)"/>
  </svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

// Recipes are household data, but favourites, ratings, and history are one
// person's. Seeding them against a placeholder account would leave Home empty
// for whoever actually signs in, so a real address wins by default.
async function resolveUser(): Promise<{ id: number; name: string; email: string }> {
  const requested = process.env.SEED_USER_EMAIL?.trim();

  if (requested) {
    const [match] = await db.select().from(users).where(eq(users.email, requested)).limit(1);
    if (!match) throw new Error(`No user with email "${requested}". Sign in once, then re-run.`);
    return match;
  }

  const all = await db.select().from(users).orderBy(users.id);
  if (all.length === 0) {
    throw new Error(
      'No users yet. Start the app and sign in once so central SSO creates your account, then re-run.',
    );
  }

  return all.find((user) => !user.email.endsWith('@example.test')) ?? all[0];
}

async function main(): Promise<void> {
  const user = await resolveUser();
  console.log(`Seeding as ${user.name} <${user.email}>`);

  const categories = new Map((await listCategories()).map((row) => [row.name, row.id]));
  const tags = new Map((await listTags()).map((row) => [row.name, row.id]));

  for (const { name, color } of TAGS) {
    if (!tags.has(name)) tags.set(name, (await createTag(name, color)).id);
  }

  const existing = new Set((await db.select({ name: recipes.name }).from(recipes)).map((r) => r.name));
  const created: { id: number; name: string }[] = [];
  let skipped = 0;

  for (const seed of RECIPES) {
    if (existing.has(seed.name)) {
      skipped += 1;
      continue;
    }

    const categoryId = categories.get(seed.category);
    if (!categoryId) throw new Error(`No category named "${seed.category}".`);

    const input = createRecipeSchema.parse({
      name: seed.name,
      description: seed.description,
      baseServings: seed.baseServings,
      prepMinutes: seed.prepMinutes,
      cookMinutes: seed.cookMinutes,
      notes: seed.notes ?? null,
      categoryId,
      ingredients: seed.ingredients,
      instructions: seed.instructions.map((body) => ({ body })),
      tagIds: seed.tags.map((tag) => tags.get(tag)!),
    });

    const recipe = await createRecipe(input, user.id);
    await replaceRecipePhoto(recipe.id, await plate(seed.colors), user.id);
    created.push({ id: recipe.id, name: recipe.name });
    console.log(`  + ${recipe.name}`);
  }

  // Only decorate what this run created, so re-running never re-rates or
  // re-trashes something already dealt with in the app.
  const byName = new Map(created.map((r) => [r.name, r.id]));
  const pick = (name: string) => byName.get(name);

  for (const name of ['Braised Short Ribs in Red Wine', 'Olive Oil Orange Cake', 'Cacio e Pepe']) {
    const id = pick(name);
    if (id) await favoriteRecipe(id, user.id);
  }

  for (const [name, rating] of [
    ['Braised Short Ribs in Red Wine', 5],
    ['Cacio e Pepe', 4],
    ['Shakshuka with Feta', 4],
  ] as const) {
    const id = pick(name);
    if (id) await rateRecipe(id, user.id, rating);
  }

  // Oldest first, so "Jump back in" reads in the order they were cooked.
  for (const name of [
    'Cacio e Pepe',
    'Lemon Ricotta Pancakes',
    'Weeknight Green Curry',
    'Salted Chocolate Chunk Cookies',
    'Braised Short Ribs in Red Wine',
  ]) {
    const id = pick(name);
    if (id) await recordView(id, user.id);
  }

  // One in the bin so Trash has something to show and restore.
  const trashed = pick('Ginger Lime Cooler');
  if (trashed) await moveRecipeToTrash(trashed, user.id);

  console.log(
    `\nDone. ${created.length} recipe${created.length === 1 ? '' : 's'} added` +
      (skipped > 0 ? `, ${skipped} already present and left alone` : '') +
      '.',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
