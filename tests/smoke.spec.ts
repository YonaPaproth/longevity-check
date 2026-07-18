import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

function collectConsoleIssues(page: Page, options?: { allowGraphWarnings?: boolean }) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;

    const text = msg.text();
    if (!text) return;

    if (options?.allowGraphWarnings && /cytoscape/i.test(text)) return;
    consoleErrors.push(text);
  });

  page.on('pageerror', (error) => {
    const text = error?.message ?? String(error);
    if (options?.allowGraphWarnings && /cytoscape/i.test(text)) return;
    pageErrors.push(text);
  });

  return {
    async expectNoIssues() {
      expect.soft(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
      expect.soft(pageErrors, `Page errors:\n${pageErrors.join('\n')}`).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    },
  };
}

async function gotoOk(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `Missing response for ${path}`).not.toBeNull();
  expect(response?.status(), `Unexpected status for ${path}`).toBe(200);
  await page.waitForLoadState('networkidle');
}

test.describe('smoke tests for critical pages', () => {
  test('Homepage (/)', async ({ page }) => {
    const issues = collectConsoleIssues(page);

    await gotoOk(page, '/');

    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.locator('main a[href^="/produkte"]').first()).toBeVisible();

    await issues.expectNoIssues();
  });

  test('Dossier page (/wirkstoffe/magnesium)', async ({ page }) => {
    const issues = collectConsoleIssues(page);

    await gotoOk(page, '/wirkstoffe/magnesium');

    await expect(page.locator('main h1').first()).toContainText('Magnesium');
    await expect(page.locator('text=/Evidenz/i').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Wichtigste Studien/i })).toBeVisible();

    await issues.expectNoIssues();
  });

  test('Product page (/produkte/now-foods-melatonin-3mg)', async ({ page }) => {
    const issues = collectConsoleIssues(page);

    await gotoOk(page, '/produkte/now-foods-melatonin-3mg');

    await expect(page.locator('main h1').first()).toContainText('Melatonin');
    await expect(page.locator('text=/Transparenz-Index|[0-9]+\.[0-9]/').first()).toBeVisible();
    await expect(page.locator('text=/pro Tag|Preis zuletzt geprüft|\/ Packung/i').first()).toBeVisible();

    await issues.expectNoIssues();
  });

  test('Graph page (/graph)', async ({ page }) => {
    const issues = collectConsoleIssues(page, { allowGraphWarnings: true });

    await gotoOk(page, '/graph');

    await expect(page.locator('#ks-cy-container, #ks-cy').first()).toBeVisible();
    await expect(page.locator('#ks-type-filters button').first()).toBeVisible({ timeout: 15000 });

    await issues.expectNoIssues();
  });

  test('English dossier (/en/ingredients/magnesium)', async ({ page }) => {
    const issues = collectConsoleIssues(page);

    await gotoOk(page, '/en/ingredients/magnesium');

    await expect(page.locator('main h1').first()).toContainText('Magnesium');

    await issues.expectNoIssues();
  });

  test('Sitemap (/sitemap-index.xml)', async ({ page }) => {
    const response = await page.goto('/sitemap-index.xml', { waitUntil: 'domcontentloaded' });
    expect(response, 'Missing response for /sitemap-index.xml').not.toBeNull();
    expect(response?.status()).toBe(200);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('<sitemapindex');
    expect(bodyText).toContain('<loc>');
  });
});
