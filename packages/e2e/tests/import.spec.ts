import { expect, test } from '@playwright/test';

// Only the paid extraction is stubbed: review, edited save, photo attachment,
// detail and scaling use the real app and a disposable migrated database.
const draft = {
  name: 'Imported tomato soup',
  description: 'A quick soup.',
  baseServings: null,
  prepMinutes: null,
  cookMinutes: 15,
  notes: null,
  ingredients: [
    {
      name: 'Tomatoes',
      quantity: null,
      unitCode: 'cup',
      unitText: null,
      preparation: 'chopped',
      originalText: '? cups tomatoes, chopped',
    },
  ],
  instructions: [{ body: 'Simmer for 15 minutes.' }],
  warnings: [
    {
      field: 'ingredients.0.quantity',
      message: 'The amount is cropped. Check the original recipe.',
    },
  ],
  importMethod: 'url',
  sourceUrl: 'https://example.com/soup',
  photoDataUrl: null,
  duplicates: [],
};
test('reviews an import on mobile, corrects uncertainty, saves and scales it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .context()
    .addCookies([{ name: 'cookbook_e2e_user', value: '1', domain: '127.0.0.1', path: '/' }]);
  await page.route('**/api/recipe-imports', (route) => route.fulfill({ json: draft }));
  await page.goto('/recipes/new');
  await page.getByLabel('Recipe link').fill('https://example.com/soup');
  await page.getByRole('button', { name: 'Preview recipe' }).click();
  await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible();
  await expect(page.getByLabel('Base servings')).toBeEmpty();
  await expect(page.getByText('The amount is cropped. Check the original recipe.')).toBeVisible();
  await expect(page.getByLabel('Original wording')).toHaveValue('? cups tomatoes, chopped');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '/tmp/cookbook-import-mobile.png', fullPage: true });
  await page.getByLabel('Base servings').fill('2');
  await page.getByLabel('Category').selectOption({ label: 'Dinner' });
  await page.getByRole('textbox', { name: 'Amount' }).fill('1 1/2');
  await page.getByRole('button', { name: 'Save recipe' }).click();
  await expect(page.getByRole('heading', { name: 'Recipe saved' })).toBeVisible();
  await page.getByRole('link', { name: 'View recipe' }).click();
  await expect(page.getByRole('heading', { name: draft.name, level: 1 })).toBeVisible();
  const ingredient = page.getByRole('listitem').filter({ hasText: 'Tomatoes' });
  await expect(ingredient).toContainText('1½ cups');
  await page.getByRole('button', { name: 'One more serving' }).click();
  await page.getByRole('button', { name: 'One more serving' }).click();
  await expect(ingredient).toContainText('3 cups');
});

test('attaches an accepted page photo only after the recipe is saved', async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: 'cookbook_e2e_user', value: '1', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/recipes/new');
  const photoDataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#b74628';
    ctx.fillRect(0, 0, 32, 24);
    return canvas.toDataURL('image/webp');
  });
  await page.route('**/api/recipe-imports', (route) =>
    route.fulfill({
      json: {
        ...draft,
        name: 'Soup with imported photo',
        baseServings: 2,
        photoDataUrl,
        warnings: [],
        ingredients: [{ ...draft.ingredients[0], quantity: '1' }],
      },
    }),
  );
  await page.getByLabel('Recipe link').fill('https://example.com/soup');
  await page.getByRole('button', { name: 'Preview recipe' }).click();
  await expect(page.getByRole('img', { name: 'Imported recipe photo' })).toBeVisible();
  await page.getByLabel('Category').selectOption({ label: 'Dinner' });
  const photoUpload = page.waitForResponse(
    (response) =>
      /\/api\/recipes\/\d+\/photo$/.test(response.url()) && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save recipe' }).click();
  expect((await photoUpload).status()).toBe(200);
  await page.getByRole('link', { name: 'View recipe' }).click();
  await expect(
    page.getByRole('heading', { name: 'Soup with imported photo', level: 1 }),
  ).toBeVisible();
  await expect(page.locator('img[src*="/photo/detail"]')).toBeVisible();
});
