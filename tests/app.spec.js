import { test, expect } from '@playwright/test';

test.describe('Passdown App', () => {
  test('loads dashboard with no errors', async ({ page }) => {
    // Navigate and wait for app to render
    await page.goto('/');
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Passdown')).toBeVisible();
    // Check no JS errors
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });

  test('navigates to all pages without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');

    const pages = [
      { nav: 'Settings', expected: 'Billet Setup' },
      { nav: 'Stakeholders', expected: 'Stakeholder Map' },
      { nav: 'Calendar', expected: 'Recurring Calendar' },
      { nav: 'Narratives', expected: 'Narrative Interview' },
      { nav: 'Search', expected: 'Search' },
      { nav: 'Verification', expected: 'Verification' },
      { nav: 'Start Here', expected: 'Start Here' },
      { nav: 'Export/Import', expected: 'Export' },
    ];

    for (const p of pages) {
      await page.click(`button:has-text("${p.nav}")`);
      await expect(page.locator(`text=${p.expected}`).first()).toBeVisible({ timeout: 5000 });
    }

    expect(errors).toEqual([]);
  });

  test('OPSEC notice is always visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=OPSEC NOTICE')).toBeVisible();
  });

  test('AI chat opens and shows setup message', async ({ page }) => {
    await page.goto('/');
    await page.click('button[title*="AI Assistant"]');
    await expect(page.locator('text=Passdown AI')).toBeVisible();
    await expect(page.locator('text=AI Model Not Loaded')).toBeVisible();
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('text=AI Model Not Loaded')).not.toBeVisible();
  });
});
