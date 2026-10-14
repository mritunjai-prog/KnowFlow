import { test, expect } from '@playwright/test';
import { installApi } from './fixtures';
test('authentication validates input, restores destination and signs out', async ({ page }) => {
  const state = await installApi(page, 'anonymous');
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect(state.requests.filter((r) => r.path === '/auth/login')).toHaveLength(0);
  await page.getByLabel('Email address').fill('reader@example.org');
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
test('library search, document correction and sharing respect role affordances', async ({
  page,
}) => {
  const state = await installApi(page);
  await page.goto('/library');
  await page.getByLabel('Search', { exact: true }).fill('missing');
  await expect(page.getByText('No documents match these filters.', { exact: false })).toBeVisible();
  await page.getByLabel('Search', { exact: true }).fill('Lecture');
  await page.getByRole('heading', { name: 'Lecture notes', exact: true }).click();
  await page.getByRole('button', { name: 'Edit document' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Corrected lecture');
  await page.getByLabel('Topics (comma separated)').fill('ML, Review, ML');
  await page.getByRole('button', { name: 'Save corrections' }).click();
  await expect(page.getByRole('heading', { name: 'Corrected lecture', exact: true })).toBeVisible();
  expect(state.doc.tags).toEqual(['ML', 'Review']);
  await page.getByLabel('Recipient email').fill('classmate@example.org');
  await page.getByRole('button', { name: 'Share document', exact: true }).click();
  await expect(page.getByText('classmate@example.org · pending')).toBeVisible();
  await page.getByLabel('Permission for classmate@example.org').selectOption('edit');
  await expect.poll(() => state.shares[0].permission).toBe('edit');
  await page.getByRole('button', { name: 'Revoke', exact: true }).click();
  await page.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await expect(page.getByText('classmate@example.org · pending')).toHaveCount(0);
  state.doc.permission = 'view';
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit document' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Share this document' })).toHaveCount(0);
});
test('tasks complete, edit, filter, create and delete without false counts', async ({ page }) => {
  const state = await installApi(page);
  await page.goto('/tasks');
  await page.getByLabel('Finish the assignment', { exact: true }).click();
  await expect(page.getByLabel('Finish the assignment', { exact: true })).toBeChecked();
  await expect.poll(() => state.tasks[0].status).toBe('completed');
  await page.getByLabel('Status', { exact: true }).selectOption('pending');
  await expect(page.getByText('No tasks match your filters.', { exact: false })).toBeVisible();
  await page.getByLabel('Status', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Task description').fill('Review the experiment');
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByText('Review the experiment', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect.poll(() => state.tasks.length).toBe(0);
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByLabel('Task description').fill('Read notes');
  await page.getByLabel('Source document', { exact: true }).selectOption('doc-1');
  await page.getByRole('button', { name: 'Save task' }).click();
  await expect(page.getByText('Read notes', { exact: true })).toBeVisible();
});
test('capture validates intake and follows processing results', async ({ page }) => {
  const state = await installApi(page);
  await page.goto('/capture');
  await page.getByRole('button', { name: 'Process knowledge' }).click();
  await expect(page.getByRole('alert')).toContainText('Add a file or some text');
  await page
    .getByLabel('Choose files or drop them here')
    .setInputFiles({
      name: 'script.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<p>bad type</p>'),
    });
  await expect(page.getByRole('alert')).toContainText('unsupported');
  await page
    .getByLabel('Choose files or drop them here')
    .setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Read my notes'),
    });
  await page.getByRole('button', { name: 'Process knowledge' }).click();
  await expect(page).toHaveURL(/\/processing\/job-1$/);
  await expect(page.getByRole('link', { name: 'Review extracted document' })).toBeVisible();
  expect(state.requests.find((r) => r.path === '/ingestions')?.body).toContain('notes.txt');
});
test('settings persist only after server confirmation', async ({ page }) => {
  const state = await installApi(page);
  await page.goto('/settings');
  await page.getByLabel('Name', { exact: true }).fill('Changed Reader');
  await page.getByLabel('Answer model').selectOption('test-model');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => state.settings.name).toBe('Changed Reader');
  await expect(page.getByText('Settings saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Changed Reader');
  await expect(page.getByLabel('Answer model')).toHaveValue('test-model');
  await page.route('**/api/v1/settings', async (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'FAILED', message: 'Save failed' } }),
        })
      : route.fallback(),
  );
  await page.getByLabel('Name', { exact: true }).fill('Not saved');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Save failed');
  expect(state.settings.name).toBe('Changed Reader');
});
test('assistant sends evidence context, saves conversation and links sources', async ({ page }) => {
  const state = await installApi(page);
  await page.goto('/assistant?documentId=doc-1');
  await page.getByLabel('Your question').fill('What should I do?');
  await page
    .getByLabel('Image context for multimodal retrieval')
    .setInputFiles({
      name: 'context.png',
      mimeType: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71]),
    });
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Finish the assignment on Friday.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lecture notes · page 1' })).toHaveAttribute(
    'href',
    '/document/doc-1?page=1',
  );
  const req = state.requests.find((r) => r.path === '/assistant/query');
  expect(req?.body).toContain('doc-1');
  expect(req?.body).toContain('context.png');
  await page.reload();
  await expect(page.getByText('Finish the assignment on Friday.', { exact: true })).toBeVisible();
});
test('meeting artifacts, decisions and summary processing are connected', async ({ page }) => {
  await installApi(page);
  await page.goto('/meetings');
  await page.getByRole('link', { name: 'Project review' }).click();
  await expect(page.getByText('Use the reviewed dataset.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lecture notes' })).toHaveAttribute(
    'href',
    '/document/doc-1',
  );
  await page.getByRole('button', { name: 'Generate summary and decisions' }).click();
  await expect(page).toHaveURL(/\/processing\/job-1$/);
});
test('admin authorization, not found and backend-offline states', async ({ page }) => {
  await installApi(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.goto('/document/does-not-exist');
  await expect(page.getByRole('alert')).toContainText('Document not found');
  await page.route('**/api/v1/session', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Service offline' } }),
    }),
  );
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Service unavailable' })).toBeVisible();
});
test('admin updates configuration through protected API', async ({ page }) => {
  const state = await installApi(page, 'admin');
  await page.goto('/admin');
  await page.getByLabel('Per-account storage limit (bytes)').fill('50000000');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect
    .poll(() =>
      state.requests.some(
        (r) => r.path === '/admin/config' && r.method === 'PATCH' && r.body?.includes('50000000'),
      ),
    )
    .toBe(true);
});
test('mobile navigation and core pages fit the viewport', async ({ page }) => {
  await installApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
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
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForTimeout(150);
    const overflow = await page
      .locator('main')
      .evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
    expect(overflow.scroll, path).toBeLessThanOrEqual(overflow.client + 2);
  }
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible();
});
test('keyboard links, counters and unavailable WebGL recover', async ({ page }) => {
  await installApi(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/dashboard');
  await expect(page.getByText('84', { exact: true })).toBeVisible({ timeout: 8000 });
  await page.getByRole('link', { name: 'Capture', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Capture knowledge' })).toBeVisible();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.includes('webgl')) return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Capture a thought.', exact: false }),
  ).toBeVisible();
});
test('recipient can accept or decline a document invitation', async ({ page }) => {
  const state = await installApi(page);
  await page.goto('/sharing');
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByRole('link', { name: 'Open shared document' })).toHaveAttribute(
    'href',
    '/document/doc-1',
  );
  expect(state.invitations[0].status).toBe('accepted');
  state.invitations[0].status = 'pending';
  await page.reload();
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await expect.poll(() => state.invitations[0].status).toBe('declined');
  await expect(page.getByRole('link', { name: 'Open shared document' })).toHaveCount(0);
});
test('failed ingestion preserves drafts and reuses its idempotency key on retry', async ({
  page,
}) => {
  await installApi(page);
  const keys: string[] = [];
  await page.route('**/api/v1/ingestions', (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Try again later' } }),
    });
  });
  await page.goto('/capture');
  await page.getByLabel('Text or transcript').fill('My captured draft');
  await page.getByRole('button', { name: 'Process knowledge' }).click();
  await expect(page.getByRole('alert')).toContainText('Try again later');
  await expect(page.getByLabel('Text or transcript')).toHaveValue('My captured draft');
  await page.getByRole('button', { name: 'Process knowledge' }).click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  await page.getByLabel('Text or transcript').fill('A different draft');
  await page.getByRole('button', { name: 'Process knowledge' }).click();
  await expect.poll(() => keys.length).toBe(3);
  expect(keys[2]).not.toBe(keys[1]);
});
test('failed job exposes retry and stops polling once successful', async ({ page }) => {
  await installApi(page);
  let failed = true;
  let loads = 0;
  await page.route('**/api/v1/jobs/job-1**', (route) => {
    if (route.request().method() === 'POST') failed = false;
    else loads++;
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'job-1',
        status: failed ? 'failed' : 'succeeded',
        stage: failed ? 'OCR unavailable' : 'Complete',
        progress: failed ? 40 : 100,
        items: [],
        error: failed ? 'Retry processing' : null,
        retryable: failed,
        meetingId: null,
      }),
    });
  });
  await page.goto('/processing/job-1');
  await expect(page.getByRole('alert')).toContainText('Retry processing');
  await page.getByRole('button', { name: 'Retry failed items' }).click();
  await expect(page.getByRole('heading', { name: 'Succeeded' })).toBeVisible();
  const terminalLoads = loads;
  await page.waitForTimeout(3300);
  expect(loads).toBe(terminalLoads);
});
test('onboarding completion persists and timeline filters use local timezone', async ({ page }) => {
  const state = await installApi(page);
  state.session.user!.onboardingComplete = false;
  await page.goto('/onboarding');
  await expect(page.getByRole('link', { name: 'Open capture' })).toHaveAttribute(
    'href',
    '/capture',
  );
  await page.getByRole('button', { name: 'Mark introduction complete' }).click();
  await expect(page.getByText('Your introduction is marked complete.')).toBeVisible();
  expect(state.session.user!.onboardingComplete).toBe(true);
  await page.goto('/timeline');
  await page.getByLabel('Topic', { exact: true }).fill('Machine Learning');
  await expect(page).toHaveURL(/topic=Machine\+Learning/);
  await expect(page.getByRole('link', { name: 'Lecture notes', exact: true })).toHaveAttribute(
    'href',
    '/document/doc-1',
  );
  const timeline = state.requests.filter((r) => r.path === '/timeline').at(-1)!;
  expect(new URLSearchParams(timeline.search).get('timezone')).toBe(
    await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
});
test('small phones, short tablets and wide screens retain usable forms', async ({ page }) => {
  test.setTimeout(60000);
  await installApi(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 768, height: 600 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of ['/capture', '/document/doc-1', '/tasks', '/dashboard', '/sharing']) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
      const dimensions = await page
        .locator('main')
        .evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
      expect(dimensions.scroll, `${path} at ${viewport.width}`).toBeLessThanOrEqual(
        dimensions.client + 2,
      );
    }
  }
  expect(errors).toEqual([]);
});
