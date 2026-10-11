import type { RecipeDetail } from '../../domain/src/types/index.js';
import { expect, test } from '@playwright/test';

// The compact introduction must keep the photo crop, reading order, and aligned
// cooking panels. Stub all data so testing favorites, ratings, and the Trash
// menu never writes to a household recipe or depends on a public photo host.
const recipe: RecipeDetail = {
  id: 12, name: 'Banana Banana Bread',
  description: 'This banana bread recipe makes an incredibly moist, delicious loaf with very ripe bananas for loads of banana flavor. It tastes even better toasted!',
  categoryId: 1, categoryName: 'Dessert', prepMinutes: 15, cookMinutes: 60, totalMinutes: 75,
  rating: { average: null, count: 0 }, userState: { favorite: false, rating: null },
  createdAt: '', updatedAt: '', hasImage: true, baseServings: 12, notes: null,
  sourceUrl: 'https://www.allrecipes.com/recipe/20144/banana-banana-bread/', sourceText: null,
  createdByUserId: 1, version: 1, tags: [],
  ingredients: [{ id: 1, position: 0, section: null, quantity: { numerator: 2, denominator: 1 }, unitCode: 'cup', unitText: null, name: 'Flour', preparation: null }],
  // Enough real content to check the cook header after scrolling, not only at the
  // top of an otherwise empty viewport.
  instructions: Array.from({ length: 12 }, (_, position) => ({
    id: position + 1, position, section: null,
    body: 'Mix the ingredients gently, then transfer to the prepared pan. Keep an eye on the oven and check the center before removing the loaf.',
  })),
  image: { cardUrl: '/api/recipes/12/photo/card', detailUrl: '/api/recipes/12/photo/detail', cardWidth: 400, cardHeight: 300, detailWidth: 800, detailHeight: 600 },
};

for (const theme of ['bloom', 'slate']) {
  for (const width of [1440, 390]) {
    for (const withImage of [true, false]) {
      test(`compact recipe header in ${theme} at ${width}px ${withImage ? 'with' : 'without'} a photo`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1100 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((value) => localStorage.setItem('pior-theme', value), theme);
        let userState = { ...recipe.userState };
        let rating = { ...recipe.rating };
        const deletions: string[] = [];
        // Match API endpoints only, not Vite's /src/api/ module requests.
        await page.route((url) => url.pathname.startsWith('/api/'), (route) => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          if (/\/photo\/(detail|card)$/.test(path)) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ddd"/></svg>' });
          if (path.endsWith('/view')) return route.fulfill({ status: 204 });
          if (path.endsWith('/favorite')) {
            userState = { ...userState, favorite: request.method() === 'PUT' };
            return route.fulfill({ json: { userState, rating } });
          }
          if (path.endsWith('/rating')) {
            userState = { ...userState, rating: request.method() === 'PUT' ? request.postDataJSON().rating : null };
            rating = { average: userState.rating, count: userState.rating == null ? 0 : 1 };
            return route.fulfill({ json: { userState, rating } });
          }
          if (request.method() === 'DELETE') deletions.push(path);
          const json = path === '/api/auth/get-session'
            ? { user: { id: 1, name: 'Test cook', email: 'cook@example.test' } }
            : path === '/api/recipes/12' ? { ...recipe, userState, rating, hasImage: withImage, image: withImage ? recipe.image : null } : [];
          return route.fulfill({ json });
        });
        await page.goto('/recipes/12');
        const title = page.getByRole('heading', { name: recipe.name, level: 1 });
        await expect(title).toBeVisible();
        const hero = page.locator('header').filter({ has: title });
        const favorite = page.getByRole('button', { name: `Add ${recipe.name} to your favorites` });
        await expect(favorite).toHaveCount(1);
        const heart = (await favorite.boundingBox())!;
        expect(heart.width).toBeGreaterThanOrEqual(44);
        expect(heart.height).toBeGreaterThanOrEqual(44);
        if (withImage) {
          const photo = (await hero.getByRole('img').boundingBox())!;
          expect(photo.width / photo.height).toBeCloseTo(4 / 3, 2);
          expect(heart.x).toBeGreaterThan(photo.x);
          expect(heart.x + heart.width).toBeLessThan(photo.x + photo.width);
          expect(heart.y).toBeGreaterThan(photo.y);
          expect(heart.y + heart.height).toBeLessThan(photo.y + photo.height);
          if (width >= 1024) {
            const summary = (await hero.locator('h1').locator('..').locator('..').locator('..').boundingBox())!;
            expect(summary.height - photo.height).toBeLessThanOrEqual(48);
          }
        }
        const source = page.getByRole('link', { name: 'www.allrecipes.com' });
        expect(await source.evaluate((element) => element.closest('footer') != null && element.closest('header') == null)).toBe(true);
        const ingredientBox = (await page.getByRole('region', { name: 'Ingredients', exact: true }).boundingBox())!;
        const instructionBox = (await page.getByRole('region', { name: 'Instructions', exact: true }).boundingBox())!;
        const footer = (await source.locator('xpath=ancestor::footer').boundingBox())!;
        const panelBottom = Math.max(ingredientBox.y + ingredientBox.height, instructionBox.y + instructionBox.height);
        expect(footer.y - panelBottom).toBeGreaterThanOrEqual(8);
        expect(footer.y - panelBottom).toBeLessThanOrEqual(16);
        if (width >= 1024) expect(instructionBox.y).toBeCloseTo(ingredientBox.y, 1);
        else expect(instructionBox.y).toBeGreaterThanOrEqual(ingredientBox.y + ingredientBox.height);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        await favorite.click();
        await page.getByRole('radio', { name: '4 stars' }).click();
        await expect(page.getByText('4.0 average from 1 rating')).toBeVisible();
        await expect(page.getByRole('button', { name: `Remove ${recipe.name} from your favorites` })).toHaveAttribute('aria-pressed', 'true');
        const more = page.getByRole('button', { name: 'More recipe actions' });
        await expect(page.getByRole('button', { name: 'Move to Trash', exact: true })).toHaveCount(0);
        await more.click();
        await page.keyboard.press('Escape');
        await expect(more).toBeFocused();
        await more.click();
        await page.getByRole('menuitem', { name: 'Move to Trash' }).click();
        await expect(page.getByRole('button', { name: 'Move to Trash', exact: true })).toBeFocused();
        await page.getByRole('button', { name: 'Keep it' }).click();
        expect(deletions).toEqual([]);
        await page.getByRole('button', { name: 'Cook this' }).click();
        const done = page.getByRole('button', { name: 'Done', exact: true });
        const cookHeader = page.locator('header').filter({ has: done });
        await expect(cookHeader).toHaveCSS('position', 'fixed');
        await expect(cookHeader).toHaveCSS('border-radius', '0px');
        const headerBox = (await cookHeader.boundingBox())!;
        expect(headerBox.x).toBe(0);
        expect(headerBox.y).toBe(0);
        expect(headerBox.width).toBe(width);
        const cookingIngredients = (await page.getByRole('region', { name: 'Ingredients', exact: true }).boundingBox())!;
        expect(cookingIngredients.y).toBeGreaterThan(headerBox.height);
        expect((await title.boundingBox())!.x).toBeCloseTo(cookingIngredients.x, 1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.evaluate(() => scrollTo(0, 700));
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
        await expect(done).toBeInViewport();
        expect((await cookHeader.boundingBox())!.y).toBe(0);
        if (width >= 1024) {
          expect((await page.getByRole('region', { name: 'Ingredients', exact: true }).boundingBox())!.y)
            .toBeGreaterThan(headerBox.height);
        }
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        await expect(more).toBeVisible();
        await page.getByRole('button', { name: 'Edit recipe' }).click();
        await expect(page).toHaveURL(/\/recipes\/12\/edit$/);
      });
    }
  }
}
