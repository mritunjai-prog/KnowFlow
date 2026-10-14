import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installApi } from './fixtures';

test('login restores the network, shader, pixel hover and keyboard-focus interaction', async ({
  page,
}, testInfo) => {
  await installApi(page, 'anonymous');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.locator('[data-login-network] canvas')).toHaveCount(1);
  await expect
    .poll(() =>
      page.locator('[data-login-shader]').evaluate((node) => (node as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(300);
  const pixels = page.locator('[data-pixel-card] canvas');
  const painted = () =>
    pixels.evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      return canvas
        .getContext('2d')!
        .getImageData(0, 0, canvas.width, canvas.height)
        .data.some((value, i) => i % 4 === 3 && value > 0);
    });
  await page.locator('[data-pixel-card]').hover();
  await expect.poll(painted).toBe(true);
  await page.mouse.move(0, 0);
  await expect.poll(painted).toBe(false);
  await page.getByLabel('Email address').focus();
  await expect.poll(painted).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('restored-login.png'), fullPage: true });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
  await page.getByRole('link', { name: 'KnowFlow', exact: true }).click();
  await expect(page.locator('[data-login-network]')).toHaveCount(0);
  await page.goto('/login');
  await expect(page.locator('[data-login-network] canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('flip retains one form, transfers focus, clears passwords and preserves server-backed registration', async ({
  page,
}) => {
  const state = await installApi(page, 'anonymous');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/login');
  await page.getByLabel('Email address').fill('reader@example.org');
  await page.getByLabel('Password', { exact: true }).fill('do not retain this');
  const [samples] = await Promise.all([
    page.evaluate(async () => {
      const samples: { total: number; active: number; transformed: boolean }[] = [];
      const start = performance.now();
      while (performance.now() - start < 1800) {
        const forms = [...document.querySelectorAll('form')];
        samples.push({
          total: forms.length,
          active: forms.filter((form) => !form.closest('[inert]')).length,
          transformed: [
            ...document.querySelectorAll('section[aria-labelledby="login-heading"]'),
          ].some((el) => getComputedStyle(el).transform !== 'none'),
        });
        await new Promise(requestAnimationFrame);
      }
      return samples;
    }),
    page.getByRole('button', { name: 'New to KnowFlow? Create an account' }).click(),
  ]);
  expect(samples.every((sample) => sample.total <= 1 && sample.active <= 1)).toBe(true);
  expect(samples.some((sample) => sample.total === 1 && sample.active === 0)).toBe(true);
  expect(samples.some((sample) => sample.transformed)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeFocused();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Email address')).toHaveValue('reader@example.org');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  expect(state.requests.filter((request) => request.path === '/auth/register')).toHaveLength(0);
  await page.getByLabel('Full name').fill('Test Reader');
  await page.getByLabel('Password', { exact: true }).fill('too short');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  expect(state.requests.filter((request) => request.path === '/auth/register')).toHaveLength(0);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  expect(state.requests.find((request) => request.path === '/auth/register')?.csrf).toBe(
    'test-csrf',
  );
});

test('reduced motion is static and responds immediately to preference changes', async ({
  page,
}) => {
  await installApi(page, 'anonymous');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.locator('[data-login-network]')).toHaveCount(0);
  await page.getByRole('button', { name: 'New to KnowFlow? Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeFocused();
  await expect(page.locator('section[aria-labelledby="login-heading"]')).toHaveCSS(
    'transform',
    'none',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('[data-login-network] canvas')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-login-network]')).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator('[data-pixel-card] canvas')
        .evaluate((node) => (node as HTMLCanvasElement).width),
    )
    .toBe(0);
  await expect
    .poll(() =>
      page.locator('[data-login-shader]').evaluate((node) => (node as HTMLCanvasElement).width),
    )
    .toBe(0);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
});

test('missing WebGL and canvas leave login functional, with failed authentication visible', async ({
  page,
}) => {
  await installApi(page, 'anonymous');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'INVALID_CREDENTIALS', message: 'Credentials could not be verified.' },
      }),
    }),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByLabel('Email address').fill('reader@example.org');
  await page.getByLabel('Password', { exact: true }).fill('wrong password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Credentials could not be verified.');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'New to KnowFlow? Create an account' }).click();
  await expect(page.getByLabel('Full name')).toBeVisible();
  expect(errors).toEqual([]);
});

test('login and registration fit narrow phones and short tablets without clipping', async ({
  page,
}) => {
  await installApi(page, 'anonymous');
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    for (const registering of [false, true]) {
      if (registering)
        await page.getByRole('button', { name: 'New to KnowFlow? Create an account' }).click();
      await expect(
        page.getByRole('heading', { name: registering ? 'Create your account' : 'Welcome back' }),
      ).toBeVisible();
      const size = await page
        .locator('main')
        .evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }));
      expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
      await page
        .getByRole('button', { name: registering ? 'Create account' : 'Sign in', exact: true })
        .scrollIntoViewIfNeeded();
      await expect(page.getByLabel('Password', { exact: true })).toBeEditable();
    }
  }
});

test('WebGL context loss keeps form input usable and restores the shader', async ({ page }) => {
  await installApi(page, 'anonymous');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/login');
  await expect(page.locator('[data-login-network] canvas')).toHaveCount(1);
  await page.getByLabel('Email address').fill('reader@example.org');
  await page.locator('[data-login-shader]').evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const extension = canvas.getContext('webgl')!.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('This browser does not expose the context-loss test extension');
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 400);
  });
  await expect(page.getByLabel('Email address')).toHaveValue('reader@example.org');
  await page.getByLabel('Password', { exact: true }).fill('Still editable');
  await expect
    .poll(() =>
      page
        .locator('[data-login-shader]')
        .evaluate((node) => !(node as HTMLCanvasElement).getContext('webgl')!.isContextLost()),
    )
    .toBe(true);
  await expect(page.locator('[data-login-shader]')).toHaveCSS('visibility', 'visible');
});
