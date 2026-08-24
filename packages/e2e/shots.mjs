import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:5273';
const OUT = '/tmp/cb-shots';

const browser = await chromium.launch();

async function shoot(name, path, { width = 1440, height = 1000, theme = 'bloom', full = false, act } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await context.addCookies([
    { name: 'cookbook_e2e_user', value: '1', domain: '127.0.0.1', path: '/' },
  ]);
  const page = await context.newPage();
  if (theme !== 'bloom') {
    await page.addInitScript((t) => window.localStorage.setItem('pior-theme', t), theme);
  }
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  if (theme !== 'bloom') {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  }
  if (act) await act(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  await context.close();
  console.log('shot', name);
}

await shoot('01-home', '/');
await shoot('02-browse', '/recipes');
await shoot('03-detail', '/recipes/1', { height: 1200 });
await shoot('04-cook', '/recipes/1', {
  height: 1200,
  act: (page) => page.getByRole('button', { name: 'Cook this' }).click(),
});
await shoot('05-organize', '/organize');
await shoot('06-trash', '/trash');
await shoot('07-new', '/recipes/new', { height: 1200 });
await shoot('08-favorites', '/favorites');
await shoot('09-slate-home', '/', { theme: 'slate' });
await shoot('10-mobile-home', '/', { width: 390, height: 844 });
await shoot('11-mobile-nav', '/', {
  width: 390,
  height: 844,
  act: (page) => page.getByRole('button', { name: 'Open navigation' }).click(),
});
await shoot('12-mobile-cook', '/recipes/1', {
  width: 390,
  height: 844,
  act: (page) => page.getByRole('button', { name: 'Cook this' }).click(),
});
await shoot('13-account-menu', '/', {
  act: (page) => page.getByRole('button', { name: /Ada/ }).click(),
});

await browser.close();
