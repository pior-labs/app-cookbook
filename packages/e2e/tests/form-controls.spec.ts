import { expect, test, type Page } from '@playwright/test';

// Field visibility and state precedence need the compiled CSS and a real
// browser. Component tests cannot catch a hover selector overpowering focus or
// an error border. Stub reads so these visual checks do not depend on recipes.
async function resolvedColor(page: Page, color: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, color);
}

async function expectGroupedRowActions(page: Page): Promise<void> {
  for (const [legend, addLabel] of [['Ingredients', 'Add ingredient'], ['Instructions', 'Add step']]) {
    const group = page.getByRole('group', { name: new RegExp(`^${legend}`) });
    const main = group.getByRole('group', { name: legend === 'Ingredients' ? 'Main ingredients' : 'Main steps', exact: true });
    const container = await main.boundingBox();
    const add = await main.getByRole('button', { name: addLabel, exact: true }).boundingBox();
    const section = await group.getByRole('button', { name: 'Add section', exact: true }).boundingBox();
    expect(container).not.toBeNull();
    expect(add).not.toBeNull();
    expect(section).not.toBeNull();
    expect(section!.height).toBeCloseTo(add!.height, 1);
    // The local action belongs inside Main; creating another group belongs
    // outside it. Checking containment avoids ambiguous paired footer buttons.
    expect(add!.x).toBeGreaterThanOrEqual(container!.x);
    expect(add!.x + add!.width).toBeLessThanOrEqual(container!.x + container!.width);
    expect(add!.y + add!.height).toBeLessThanOrEqual(container!.y + container!.height);
    expect(section!.y).toBeGreaterThanOrEqual(container!.y + container!.height);
  }
}

async function expectSourceActionLayout(page: Page): Promise<void> {
  const sourceControl = page.locator('#import-url, #import-image');
  await expect(sourceControl).toBeVisible();
  const source = await sourceControl.boundingBox();
  const preview = await page.getByRole('button', { name: 'Preview recipe', exact: true }).boundingBox();
  expect(source).not.toBeNull();
  expect(preview).not.toBeNull();
  if (page.viewportSize()!.width >= 640) {
    expect(preview!.x).toBeGreaterThanOrEqual(source!.x + source!.width);
    expect(preview!.y + preview!.height / 2).toBeCloseTo(source!.y + source!.height / 2, 1);
  } else {
    expect(preview!.y).toBeGreaterThanOrEqual(source!.y + source!.height);
    expect(preview!.width).toBeCloseTo(source!.width, 1);
  }
}

for (const theme of ['bloom', 'slate']) {
  test(`fields keep theme-derived boundaries and distinct states in ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('pior-theme', value), theme);
    // Vite also serves /src/api/*.ts modules. A substring glob would replace
    // those modules with JSON and leave a blank page before any assertion runs.
    await page.route(url => url.pathname.startsWith('/api/'), (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = path === '/api/auth/get-session'
        ? { user: { id: 1, name: 'Test cook', email: 'cook@example.test' } }
        : path === '/api/categories'
          ? [{ id: 1, name: 'Dinner', activeRecipeCount: 0, createdAt: '', updatedAt: '' }]
          : [];
      return route.fulfill({ json });
    });
    await page.goto('/recipes/new');
    await expectSourceActionLayout(page);
    const desktopViewport = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    await expectSourceActionLayout(page);
    await page.setViewportSize(desktopViewport);
    const meshOpacity = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--blob-opacity').trim(),
    );
    await expect(page.locator('.cb-app .theme-mesh')).toHaveCSS('opacity', String(Number(meshOpacity)));
    const secondaryFill = await resolvedColor(page, 'color-mix(in oklab, var(--frost) 65%, transparent)');
    const secondaryHover = await resolvedColor(page, 'color-mix(in oklab, var(--frost) 90%, transparent)');
    for (const name of ['Import from image', 'Enter manually']) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toHaveCSS('background-color', secondaryFill);
      await expect(button).not.toHaveCSS('box-shadow', 'none');
      await button.hover();
      await expect(button).toHaveCSS('background-color', secondaryHover);
      await page.mouse.move(0, 0);
    }
    await page.getByRole('button', { name: 'Import from image', exact: true }).click();
    await expectSourceActionLayout(page);
    await expect(page.getByRole('button', { name: 'Import from image', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Import from link', exact: true })).toHaveCSS('background-color', secondaryFill);
    await page.getByRole('button', { name: 'Enter manually' }).click();
    await page.getByRole('button', { name: 'Back to recipe options' }).click();
    await expect(page.getByRole('group', { name: 'Recipe entry method' })).toBeVisible();
    await page.getByRole('button', { name: 'Enter manually' }).click();

    const input = page.getByRole('textbox', { name: 'Recipe name', exact: true });
    const area = page.getByRole('textbox', { name: 'Description', exact: true });
    const select = page.getByRole('combobox', { name: 'Category', exact: true });
    const idle = await resolvedColor(page, 'transparent');
    const fill = await resolvedColor(page, 'rgba(var(--surface-rgb), 0.96)');
    const hoverFill = await resolvedColor(page, 'var(--frost)');
    const sheet = await resolvedColor(page, 'color-mix(in srgb, var(--muted) 85%, rgba(var(--surface-rgb), 1))');
    const focus = await resolvedColor(page, 'var(--accent)');
    const error = await resolvedColor(page, 'var(--destructive)');

    await expect(page.locator('section').first()).toHaveCSS('background-color', sheet);
    await expectGroupedRowActions(page);
    await page.mouse.move(0, 0);
    for (const control of [input, area, select]) {
      await expect(control).toBeVisible();
      await expect(control).toHaveCSS('border-top-width', '1px');
      await expect(control).toHaveCSS('border-top-color', idle);
      await expect(control).toHaveCSS('background-color', fill);
      const idleShadow = await control.evaluate((element) => getComputedStyle(element).boxShadow);
      expect(idleShadow).not.toBe('none');
      await control.hover();
      await expect(control).toHaveCSS('border-top-color', idle);
      await expect(control).toHaveCSS('background-color', hoverFill);
      await control.focus();
      await expect(control).toHaveCSS('border-top-color', focus);
      await expect(control).not.toHaveCSS('box-shadow', idleShadow);
      await control.blur();
      await page.mouse.move(0, 0);
    }

    await page.getByRole('button', { name: 'Save recipe', exact: true }).click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.hover();
    await input.focus();
    await expect(input).toHaveCSS('border-top-color', error);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectGroupedRowActions(page);
    await expect(area).toBeVisible();
    await expect(area).toHaveCSS('border-top-color', idle);
    await expect(area).toHaveCSS('background-color', fill);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
