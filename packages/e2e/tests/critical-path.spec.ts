import { expect, test, type Browser, type Page } from '@playwright/test';

// The critical path from technical design section 14: create and view a
// recipe, edit it and adjust servings, find it by ingredient, favorite and rate
// it as one cook without affecting another, and move it to Trash and back.
//
// Everything underneath this is covered by faster tests. These exist to prove
// the pieces are wired together: a real browser, the real API, a real migrated
// database, and the same build a cook would load.

// The seeded people the harness creates, in order.
const ADA = 1;
const GRACE = 2;

const RECIPE = 'Weeknight Chili';
const INGREDIENT = 'Ground beef';

// How the detail screen writes the amount: a Unicode fraction, and a unit label
// that agrees with it.
const AT_BASE = '1½ pounds';
const DOUBLED = '3 pounds';

// The amount and the ingredient name are separate elements, so the assertion is
// against the row that holds both.
function ingredientRow(page: Page) {
  return page.getByRole('listitem').filter({ hasText: INGREDIENT });
}

// The harness reads this cookie instead of a central SSO session, which is the
// controlled authenticated state section 14 allows.
async function signIn(page: Page, userId: number): Promise<void> {
  await page.context().addCookies([
    { name: 'cookbook_e2e_user', value: String(userId), domain: '127.0.0.1', path: '/' },
  ]);
}

async function openAs(browser: Browser, userId: number): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, userId);

  return page;
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await signIn(page, ADA);
});

test('creates a recipe and shows it to the cook who wrote it', async ({ page }) => {
  await page.goto('/recipes/new');

  await page.getByLabel('Recipe name').fill(RECIPE);
  await page.getByLabel('Description').fill('A one-pot chili the household actually finishes.');
  await page.getByLabel('Category').selectOption({ label: 'Dinner' });
  await page.getByLabel('Base servings').fill('4');
  await page.getByLabel('Prep minutes').fill('15');
  await page.getByLabel('Cook minutes').fill('45');

  // By role rather than by label: the reorder controls in each row are labelled
  // after the ingredient they move, so "Ingredient" alone is ambiguous.
  await page.getByRole('textbox', { name: 'Amount' }).fill('1 1/2');
  await page.getByRole('combobox', { name: 'Unit', exact: true }).selectOption('lb');
  await page.getByRole('textbox', { name: 'Ingredient', exact: true }).fill(INGREDIENT);
  await page
    .getByRole('textbox', { name: 'Step 1' })
    .fill('Brown the beef, then simmer everything for 40 minutes.');

  await page.getByRole('button', { name: 'Save recipe' }).click();

  await expect(page.getByRole('heading', { name: 'Recipe saved' })).toBeVisible();
  await page.getByRole('link', { name: 'View recipe' }).click();

  await expect(page.getByRole('heading', { name: RECIPE, level: 1 })).toBeVisible();
  await expect(page.getByText('1 hr')).toBeVisible();
  await expect(ingredientRow(page)).toContainText(AT_BASE);
});

test('scales servings for the cook without touching the saved recipe', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: new RegExp(RECIPE) }).first().click();

  await expect(ingredientRow(page)).toContainText(AT_BASE);

  // Doubling is exact fraction arithmetic, not 1.5 × 2 in floating point, and
  // the unit label follows the amount from "pounds" at 1½ to "pounds" at 3.
  for (let press = 0; press < 4; press += 1) {
    await page.getByRole('button', { name: 'One more serving' }).click();
  }
  await expect(ingredientRow(page)).toContainText(DOUBLED);

  // Reloading proves the scaling was view state: the saved recipe is untouched.
  await page.reload();
  await expect(ingredientRow(page)).toContainText(AT_BASE);
});

test('edits the recipe and keeps the change', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: new RegExp(RECIPE) }).first().click();
  await page.getByRole('button', { name: 'Edit recipe' }).click();

  await page.getByLabel('Description').fill('Better the next day.');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Better the next day.')).toBeVisible();
});

test('finds the recipe by an ingredient rather than its name', async ({ page }) => {
  await page.goto('/recipes');
  await page.getByLabel('Search').fill(INGREDIENT);

  await expect(page.getByRole('link', { name: new RegExp(RECIPE) })).toBeVisible();

  await page.getByLabel('Search').fill('nothing matches this');
  await expect(page.getByText('Nothing matches that yet.')).toBeVisible();
});

test('favorites and rates as one cook without affecting another', async ({ page, browser }) => {
  await page.goto('/recipes');
  await page.getByRole('link', { name: new RegExp(RECIPE) }).first().click();
  const recipeUrl = page.url();

  await page.getByRole('button', { name: `Add ${RECIPE} to your favorites` }).click();
  await expect(page.getByRole('button', { name: `Remove ${RECIPE} from your favorites` })).toBeVisible();

  await page.getByRole('radio', { name: '5 stars' }).click();
  await expect(page.getByText('5.0 average from 1 rating')).toBeVisible();

  await page.goto('/favorites');
  await expect(page.getByRole('link', { name: new RegExp(RECIPE) })).toBeVisible();

  const grace = await openAs(browser, GRACE);
  await grace.goto('/favorites');
  await expect(grace.getByText('No favorites yet.')).toBeVisible();

  // The household average moves for everyone; the star each person pressed
  // does not.
  await grace.goto('/recipes');
  await grace.getByRole('link', { name: new RegExp(RECIPE) }).first().click();
  await grace.getByRole('radio', { name: '3 stars' }).click();
  await expect(grace.getByText('4.0 average from 2 ratings')).toBeVisible();

  await page.goto(recipeUrl);
  await expect(page.getByRole('radio', { name: '5 stars' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('4.0 average from 2 ratings')).toBeVisible();

  await grace.context().close();
});

test('moves the recipe to Trash and restores everything it had', async ({ page }) => {
  await page.goto('/recipes');
  await page.getByRole('link', { name: new RegExp(RECIPE) }).first().click();

  await page.getByRole('button', { name: 'Move to Trash' }).click();
  await page.getByRole('button', { name: 'Move to Trash' }).click();

  await expect(page).toHaveURL(/\/trash$/);
  await expect(page.getByRole('heading', { name: RECIPE })).toBeVisible();

  // Gone from the live cookbook while it sits in Trash.
  await page.goto('/recipes');
  await expect(page.getByRole('link', { name: new RegExp(RECIPE) })).toHaveCount(0);

  await page.goto('/trash');
  await page.getByRole('button', { name: `Restore ${RECIPE}` }).click();
  await expect(page.getByText('Trash is empty.')).toBeVisible();

  // Back with its rating and this cook's favorite intact.
  await page.goto('/recipes');
  await page.getByRole('link', { name: new RegExp(RECIPE) }).first().click();
  await expect(page.getByText('4.0 average from 2 ratings')).toBeVisible();
  await expect(page.getByRole('button', { name: `Remove ${RECIPE} from your favorites` })).toBeVisible();
  await expect(page.getByText('Better the next day.')).toBeVisible();
});
