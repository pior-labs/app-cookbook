import { expect, test } from '@playwright/test';

for (const width of [320, 360, 390, 1440]) {
  for (const kind of ['Ingredient', 'Step'] as const) {
    test(`${kind.toLowerCase()} section toolbar aligns and its menu stays on-screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.context().addCookies([{ name: 'cookbook_e2e_user', value: '1', domain: '127.0.0.1', path: '/' }]);
      await page.goto('/recipes/new');
      await page.getByRole('button', { name: 'Enter manually' }).click();
      const list = page.getByRole('group', { name: kind === 'Ingredient' ? /^Ingredients/ : /^Instructions/ });
      await list.getByRole('button', { name: 'Add section', exact: true }).click();
      const name = kind === 'Ingredient' ? 'Sauces' : 'Mix';
      const input = list.getByRole('textbox', { name: `${kind} section 1`, exact: true });
      await input.fill(name);
      const section = list.getByRole('group', { name, exact: true });
      await section.getByRole('button', { name: kind === 'Ingredient' ? 'Add ingredient' : 'Add step', exact: true }).click();
      const trigger = section.getByRole('button', { name: `${kind} section 1 options`, exact: true });
      await trigger.click();
      const menu = section.getByRole('menu');
      await expect(menu).toBeVisible();
      const label = section.locator(`label[for="${await input.getAttribute('id')}"]`);
      const labelBounds = await label.boundingBox();
      const triggerBounds = await trigger.boundingBox();
      const inputBounds = await input.boundingBox();
      expect(labelBounds).not.toBeNull();
      expect(triggerBounds).not.toBeNull();
      expect(inputBounds).not.toBeNull();
      // The dots share the label's line on phones and desktops. The name stays
      // full-width below, rather than reserving a column or an extra action row.
      expect(labelBounds!.y + labelBounds!.height / 2).toBeCloseTo(triggerBounds!.y + triggerBounds!.height / 2, 1);
      expect(inputBounds!.y).toBeGreaterThanOrEqual(triggerBounds!.y + triggerBounds!.height);
      expect(inputBounds!.x).toBeCloseTo(labelBounds!.x, 1);
      expect(inputBounds!.x + inputBounds!.width).toBeCloseTo(triggerBounds!.x + triggerBounds!.width, 1);
      expect(triggerBounds!.height).toBeGreaterThanOrEqual(44);
      expect(triggerBounds!.width).toBeGreaterThanOrEqual(44);
      const bounds = await menu.boundingBox();
      expect(bounds).not.toBeNull();
      // Negative left overflow can clip a popup without increasing scrollWidth.
      // Check the actual popup, not just the page's horizontal scrollbar.
      expect(bounds!.x).toBeGreaterThanOrEqual(8);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 8);
      await expect(menu.getByRole('menuitem', { name: /Remove heading/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  }
}

test('adds independent recipe sections on mobile and cooks through continuous steps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([{ name: 'cookbook_e2e_user', value: '1', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/recipes/new');
  await page.getByRole('button', { name: 'Enter manually' }).click();
  await page.getByLabel('Recipe name').fill('Sectioned focaccia');
  await page.getByLabel('Category').selectOption({ label: 'Dinner' });
  await page.getByRole('textbox', { name: 'Ingredient', exact: true }).fill('Flour');
  await page.getByRole('textbox', { name: 'Step 1', exact: true }).fill('Mix the dough.');
  const ingredients = page.getByRole('group', { name: /Ingredients/ });
  await ingredients.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ingredient section 1', exact: true }).fill('For the sauce');
  await expect(ingredients.getByRole('group', { name: 'Main ingredients', exact: true }).getByRole('textbox', { name: 'Ingredient', exact: true })).toHaveValue('Flour');
  await page.getByRole('textbox', { name: 'Ingredient', exact: true }).nth(1).fill('Olive oil');
  const steps = page.getByRole('group', { name: /Instructions/ });
  await steps.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('textbox', { name: 'Step section 1', exact: true }).fill('Shape & bake');
  await page.getByRole('textbox', { name: 'Step 2', exact: true }).fill('Bake until golden.');
  await ingredients.getByRole('group', { name: 'Main ingredients', exact: true }).getByRole('button', { name: 'Add ingredient' }).click();
  await ingredients.getByRole('group', { name: 'Main ingredients', exact: true }).getByRole('textbox', { name: 'Ingredient', exact: true }).nth(1).fill('Salt');
  await expect(ingredients.getByRole('group', { name: 'For the sauce', exact: true }).getByRole('textbox', { name: 'Ingredient', exact: true })).toHaveValue('Olive oil');
  const saving = page.waitForResponse(response => response.url().endsWith('/api/recipes') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save recipe' }).click();
  const saved = await (await saving).json();
  expect(saved.ingredients.map((row: { section: string | null }) => row.section)).toEqual([null, null, 'For the sauce']);
  expect(saved.instructions.map((row: { section: string | null }) => row.section)).toEqual([null, 'Shape & bake']);
  await page.getByRole('link', { name: 'View recipe' }).click();
  await expect(page.getByRole('heading', { name: 'For the sauce', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shape & bake', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Cook this' }).click();
  await expect(page.getByRole('heading', { name: 'For the sauce', exact: true })).toBeVisible();
  const step = page.getByRole('button', { name: 'Step 2: Bake until golden.' });
  await step.click();
  await expect(step).toHaveAttribute('aria-pressed', 'true');
});
