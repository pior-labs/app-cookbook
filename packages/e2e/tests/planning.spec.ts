import { expect, test } from '@playwright/test';

test('plans meals, reviews suggestions and shops from a persistent mobile grocery list', async ({
  page,
}) => {
  await page
    .context()
    .addCookies([{ name: 'cookbook_e2e_user', value: '1', domain: '127.0.0.1', path: '/' }]);
  const categories = await (await page.request.get('/api/categories')).json();
  const created = await page.request.post('/api/recipes', {
    data: {
      name: 'Planning test soup',
      description: 'A quick dinner.',
      baseServings: 4,
      prepMinutes: 10,
      cookMinutes: 15,
      categoryId: categories[0].id,
      ingredients: [
        { name: 'green onion', quantity: '4' },
        { name: 'chicken breast', quantity: '1/2', unitCode: 'kg' },
      ],
      instructions: [{ body: 'Simmer until cooked.' }],
    },
  });
  expect(created.status()).toBe(201);
  await page.goto('/meal-plans');
  await page.getByLabel('Plan name').fill('A few dinners');
  await page.getByRole('button', { name: 'Create meal plan' }).click();
  await expect(page.getByRole('heading', { name: 'A few dinners' })).toBeVisible();
  const planUrl = page.url();
  await page.getByRole('button', { name: 'Add another meal' }).click();
  await page.getByRole('button', { name: 'Choose Planning test soup', exact: true }).click();
  await expect(page.getByText('2 servings', { exact: false }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Planning test soup' })).toBeVisible();
  await page.getByRole('button', { name: 'Help me choose' }).click();
  const dialog = page.getByRole('dialog', { name: 'Help me choose' });
  await dialog.getByLabel('Number of meals').fill('1');
  await dialog.getByRole('button', { name: 'Suggest meals' }).click();
  await expect(dialog.getByRole('heading', { name: 'Suggested meal plan' })).toBeVisible();
  const planBefore = await (
    await page.request.get('/api/meal-plans/' + planUrl.split('/').at(-1))
  ).json();
  expect(planBefore.items).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Generate grocery list' }).click();
  await expect(page.getByRole('heading', { name: 'Grocery list', exact: true })).toBeVisible();
  await expect(page.getByText('250 g chicken breast', { exact: true })).toBeVisible();
  await page.getByText('Where this comes from').first().click();
  await expect(page.getByText(/Planning test soup —/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByLabel('Item name').fill('Paper towels');
  await page.getByRole('dialog').getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(page.getByText('Paper towels', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Paper towels' }).click();
  await page.getByLabel('Quantity (optional)').fill('2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('2 Paper towels', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Shopping mode' }).click();
  await page.getByRole('checkbox', { name: '2 Paper towels' }).check();
  await expect(page.getByText('2 of 3 items remaining')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const touchTarget = await page
    .getByRole('checkbox', { name: '2 Paper towels' })
    .locator('..')
    .boundingBox();
  expect(touchTarget?.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: '/tmp/cookbook-phase2-shopping.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('checkbox', { name: '2 Paper towels' })).toBeChecked();
  await page.getByRole('button', { name: 'Copy list', exact: true }).click();
  await expect(
    page
      .getByText('Grocery list copied.')
      .first()
      .or(page.getByRole('dialog', { name: 'Copy grocery list' })),
  ).toBeVisible();
  if (await page.getByRole('dialog', { name: 'Copy grocery list' }).isVisible()) {
    await expect(page.getByLabel('Grocery list text')).toContainText('Paper towels');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Copy list', exact: true })).toBeFocused();
  }
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
  await page.getByRole('button', { name: 'Generate fresh list' }).click();
  await expect(page.getByText('250 g chicken breast', { exact: true })).toBeVisible();
  await expect(page.getByText('2 Paper towels', { exact: true })).toHaveCount(0);
});
