import { expect, test } from '@playwright/test';

// Keyboard behaviour that only a real browser can prove: the rest of the
// accessible markup is asserted by the component tests, but focus order and
// focus movement are the browser's own (technical design sections 11.2
// and 14.3).

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    { name: 'cookbook_e2e_user', value: '1', domain: '127.0.0.1', path: '/' },
  ]);
});

test('offers a skip link past the section navigation', async ({ page }) => {
  await page.goto('/recipes');

  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeAttached();

  // Six section links and two actions sit ahead of the content, so the first
  // press of Tab has to be the way past them.
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.locator('#cookbook-main')).toBeFocused();
});
