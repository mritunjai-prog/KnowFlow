import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installApi } from './fixtures';
test('core route states have no detected WCAG A/AA violations', async ({ page }) => {
  test.setTimeout(90000);
  await installApi(page, 'admin');
  for (const path of [
    '/dashboard',
    '/capture',
    '/library',
    '/document/doc-1',
    '/tasks',
    '/settings',
    '/timeline',
    '/assistant',
    '/meetings/meeting-1',
    '/admin',
    '/sharing',
    '/onboarding',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
    await page.waitForTimeout(100);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations, path).toEqual([]);
  }
});
test('public pages and single auth form remain accessible', async ({ page }) => {
  await installApi(page, 'anonymous');
  for (const path of ['/', '/login']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations, path).toEqual([]);
  }
  await page.getByRole('button', { name: 'New to KnowFlow? Create an account' }).click();
  await expect(page.getByLabel('Full name')).toBeVisible();
  await expect(page.locator('form')).toHaveCount(1);
});
test('camera permission denial is recoverable without losing draft text', async ({ page }) => {
  await installApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      },
      configurable: true,
    });
  });
  await page.goto('/capture');
  await page.getByLabel('Text or transcript').fill('Keep this draft');
  await page.getByRole('button', { name: 'Open camera' }).click();
  await expect(page.getByRole('alert')).toContainText('Permission was denied');
  await expect(page.getByLabel('Text or transcript')).toHaveValue('Keep this draft');
  await expect(page.getByRole('button', { name: 'Open camera' })).toBeEnabled();
});
