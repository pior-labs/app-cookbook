import { expect, test } from '@playwright/test';

// The whole life of a meal plan (ADR 0010): planned as a draft, saved into its
// one grocery list, shopped from on a phone, reopened and saved again with the
// shop carried forward, marked done, brought back, and deleted.
test('plans meals, saves them into one grocery list, shops from it and carries the shop across an edit', async ({
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

  // --- Draft --------------------------------------------------------------
  await page.goto('/meal-plans');
  await page.getByRole('button', { name: 'New meal plan' }).click();
  await page.getByLabel('Plan name').fill('A few dinners');
  await page.getByRole('button', { name: 'Create meal plan' }).click();
  await expect(page.getByRole('heading', { name: 'A few dinners' })).toBeVisible();
  const planId = page.url().split('/').at(-1);
  await page.getByRole('button', { name: 'Add a meal', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Planning test soup', exact: true }).click();
  await expect(page.getByText('2 servings', { exact: false }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Planning test soup' })).toBeVisible();

  await page.getByRole('button', { name: 'Meal plan options' }).click();
  await page.getByRole('menuitem', { name: 'Rename plan' }).click();
  await page.getByLabel('Plan name').fill('Dinners this week');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('heading', { name: 'Dinners this week' })).toBeVisible();

  // Asking and answering are two steps: the answer gets its own title, and
  // going back keeps what was asked.
  await page.getByRole('button', { name: 'Help me choose' }).click();
  const ask = page.getByRole('dialog', { name: 'Help me choose' });
  await ask.getByLabel('What are you in the mood for?').fill('Something warm');
  await ask.getByLabel('Number of meals').fill('1');
  await ask.getByRole('button', { name: 'Suggest meals' }).click();
  const answer = page.getByRole('dialog', { name: 'Suggested meal plan' });
  await expect(answer.getByRole('listitem')).toHaveCount(1);
  await expect(answer.getByRole('button', { name: 'Use this plan' })).toBeVisible();
  await answer.getByRole('button', { name: 'Change what you asked for' }).click();
  await expect(ask.getByLabel('What are you in the mood for?')).toHaveValue('Something warm');
  await ask.getByRole('button', { name: 'Suggest meals' }).click();
  await answer.getByRole('button', { name: 'Try again' }).click();
  await expect(answer.getByRole('listitem')).toHaveCount(1);
  // A suggestion changes nothing until it is accepted.
  expect((await (await page.request.get(`/api/meal-plans/${planId}`)).json()).items).toHaveLength(1);
  await answer.getByRole('button', { name: 'Cancel' }).click();
  await expect(answer).toHaveCount(0);

  // --- Saved --------------------------------------------------------------
  await page.getByRole('button', { name: 'Save meal plan' }).click();
  await expect(page.getByRole('heading', { name: 'Grocery list', exact: true })).toBeVisible();
  await expect(page.getByText(/^Saved /)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '250 g chicken breast' })).toBeVisible();
  // The meals are closed now: no steppers, no suggestions, no save.
  await expect(page.getByRole('button', { name: /One more serving/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Help me choose' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Planning test soup/ })).toBeVisible();

  // Each row says which meals it is for; the per-recipe amounts are in Edit.
  await expect(page.getByText('Planning test soup', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Options for chicken breast' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit grocery item' });
  await expect(editor.getByText('What the meals asked for')).toBeVisible();
  // The recipe's own unit, scaled to the plan; the list shows it as 250 g.
  await expect(editor.getByText('¼ kg')).toBeVisible();
  await editor.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByLabel('Item name').fill('Paper towels');
  await page.getByRole('dialog').getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Paper towels' })).toBeVisible();
  await page.getByRole('button', { name: 'Options for Paper towels' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.getByLabel('Quantity (optional)').fill('2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('checkbox', { name: '2 Paper towels' })).toBeVisible();

  // --- Shopping on a phone --------------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Start shopping' }).click();
  await expect(page.getByRole('heading', { name: 'Shopping' })).toBeVisible();
  await page.getByRole('checkbox', { name: '2 Paper towels' }).check();
  await page.getByRole('checkbox', { name: '2 green onion' }).check();
  await expect(page.getByText('1 of 3 left')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const touchTarget = await page
    .getByRole('checkbox', { name: '2 Paper towels' })
    .locator('..')
    .boundingBox();
  expect(touchTarget?.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: '/tmp/cookbook-phase2-shopping.png', fullPage: true });
  await page.getByRole('button', { name: 'Done shopping' }).click();
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

  // --- Edited and saved again --------------------------------------------------
  const listId = (await (await page.request.get(`/api/meal-plans/${planId}`)).json())
    .groceryListId;
  await page.getByRole('button', { name: 'Meal plan options' }).click();
  await page.getByRole('menuitem', { name: 'Edit plan' }).click();
  await expect(page.getByText('Changing the meals')).toBeVisible();
  // The list stays usable while the meals change: someone may be in the shop.
  await expect(page.getByRole('checkbox', { name: '2 Paper towels' })).toBeEnabled();
  await page.getByRole('button', { name: 'One more serving of Planning test soup' }).click();
  await expect(page.getByText('3 servings', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Save meal plan' }).click();
  await expect(page.getByText(/^Saved /)).toBeVisible();

  // The same list, rebuilt. The hand-added towels are still there and still
  // ticked; the onions now need more than was ticked, so they are unticked and
  // say why.
  expect((await (await page.request.get(`/api/meal-plans/${planId}`)).json()).groceryListId).toBe(
    listId,
  );
  await expect(page.getByRole('checkbox', { name: '2 Paper towels' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '3 green onion' })).not.toBeChecked();
  await expect(page.getByText('Your meals changed since you ticked this off.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '375 g chicken breast' })).toBeVisible();

  // --- Done, and back ---------------------------------------------------------
  await page.getByRole('button', { name: 'Meal plan options' }).click();
  await page.getByRole('menuitem', { name: 'Mark as done' }).click();
  await expect(page.getByText(/^Done /)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '2 Paper towels' })).toBeDisabled();
  await page.goto('/meal-plans');
  await expect(page.getByRole('heading', { name: 'Done', exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Dinners this week/ }).click();
  await page.getByRole('button', { name: 'Back to shopping' }).click();
  await expect(page.getByText(/^Saved /)).toBeVisible();

  // A link to the list from before it lived on the plan still finds it.
  await page.goto(`/grocery-lists/${listId}`);
  await expect(page).toHaveURL(new RegExp(`/meal-plans/${planId}$`));

  // --- Deleted -------------------------------------------------------------------
  await page.getByRole('button', { name: 'Meal plan options' }).click();
  await page.getByRole('menuitem', { name: 'Delete plan' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete this meal plan?' });
  await expect(confirm).toContainText('grocery list');
  await confirm.getByRole('button', { name: 'Delete meal plan' }).click();
  await expect(page).toHaveURL(/\/meal-plans$/);
  await expect(page.getByRole('heading', { name: 'Dinners this week' })).toHaveCount(0);
  expect((await page.request.get(`/api/grocery-lists/${listId}`)).status()).toBe(404);
});
