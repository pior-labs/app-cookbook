import { expect, test } from '@playwright/test';

// Renaming is an in-place edit, not a full-width panel. Browser geometry catches
// grid reflow and cramped actions that component tests cannot see. All requests
// are stubbed so these layout checks never change household organization data.
const categories = [
  { id: 1, name: 'Breakfast', activeRecipeCount: 2 },
  { id: 2, name: 'Dinner', activeRecipeCount: 4 },
];
const tags = [
  { id: 7, name: 'Comfort', activeRecipeCount: 3, color: '#c96442' },
  { id: 8, name: 'Weeknight', activeRecipeCount: 4, color: '#5b8a5a' },
];

for (const theme of ['bloom', 'slate']) {
  for (const width of [1440, 768, 390]) {
    test(`category and tag renaming stay in their grid slots in ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1100 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('pior-theme', value), theme);
      await page.route('**/api/**', (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (request.method() === 'PUT') {
          const items = path.startsWith('/api/categories/') ? categories : tags;
          const item = items.find((candidate) => candidate.id === Number(path.split('/').pop()));
          return route.fulfill({ json: { ...item, ...request.postDataJSON() } });
        }
        const json = path === '/api/auth/get-session'
          ? { user: { id: 1, name: 'Test cook', email: 'cook@example.test' } }
          : path === '/api/categories' ? categories : path === '/api/tags' ? tags : [];
        return route.fulfill({ json });
      });
      await page.goto('/organize');

      for (const [sectionName, name] of [['Categories', 'Breakfast'], ['Tags', 'Comfort']]) {
        const section = page.getByRole('region', { name: sectionName, exact: true });
        const row = section.getByRole('listitem').nth(0);
        const neighbor = section.getByRole('listitem').nth(1);
        const rename = row.getByRole('button', { name: `Rename ${name}`, exact: true });
        await expect(rename).toBeVisible();
        const before = await row.boundingBox();
        const neighborBefore = await neighbor.boundingBox();
        expect(before).not.toBeNull();
        expect(neighborBefore).not.toBeNull();

        await rename.click();
        const input = row.getByRole('textbox', { name: `Rename ${name}`, exact: true });
        await expect(input).toBeFocused();
        const after = await row.boundingBox();
        const neighborAfter = await neighbor.boundingBox();
        expect(after).not.toBeNull();
        expect(neighborAfter).not.toBeNull();
        expect(after!.width).toBeCloseTo(before!.width, 1);
        expect(after!.x).toBeCloseTo(before!.x, 1);
        expect(neighborAfter!.x).toBeCloseTo(neighborBefore!.x, 1);
        if (width >= 640) expect(neighborAfter!.y).toBeCloseTo(after!.y, 1);

        for (const control of [input, row.getByRole('button', { name: 'Save', exact: true }), row.getByRole('button', { name: 'Cancel', exact: true })]) {
          const box = await control.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(after!.x);
          expect(box!.x + box!.width).toBeLessThanOrEqual(after!.x + after!.width);
        }
        expect((await input.boundingBox())!.width).toBeGreaterThan(100);

        await input.fill('Unsaved name');
        await row.getByRole('button', { name: 'Cancel', exact: true }).click();
        await rename.click();
        await expect(input).toHaveValue(name);
        await input.fill(`${name} edited`);
        await row.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(row.getByRole('button', { name: `Rename ${name} edited`, exact: true })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
