import { test, expect } from '@playwright/test';

test.describe('Store / Data Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage
    await page.evaluate(() => {
      Object.keys(localStorage).filter(k => k.startsWith('passdown_')).forEach(k => localStorage.removeItem(k));
    });
    await page.reload();
  });

  test('saves and loads billet info', async ({ page }) => {
    await page.click('button:has-text("Settings")');
    await page.fill('input[placeholder*="S-3"]', 'Test Billet Officer');
    await page.fill('input[placeholder*="1st Bn"]', 'Test Unit');
    await page.click('button:has-text("Save Billet")');

    // Reload and check persistence
    await page.reload();
    await page.click('button:has-text("Settings")');
    await expect(page.locator('input[placeholder*="S-3"]')).toHaveValue('Test Billet Officer');
  });

  test('creates and persists an entry', async ({ page }) => {
    await page.click('button:has-text("Add Entry")');
    await page.fill('input[placeholder*="Title"]', 'Test Process Entry');
    await page.fill('textarea[placeholder*="Write your"]', 'This is a test entry content.');
    await page.click('button:has-text("Create Entry")');

    // Check dashboard shows 1 entry
    await page.click('button:has-text("Dashboard")');
    await expect(page.locator('text=Total Entries')).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('passdown_entries');
      return raw ? JSON.parse(raw).length : 0;
    });
    expect(stored).toBe(1);
  });

  test('export and import round-trip', async ({ page }) => {
    // Create an entry first
    await page.click('button:has-text("Add Entry")');
    await page.fill('input[placeholder*="Title"]', 'Round Trip Entry');
    await page.fill('textarea[placeholder*="Write your"]', 'Content for round trip test.');
    await page.click('button:has-text("Create Entry")');

    // Export
    await page.click('button:has-text("Export/Import")');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export Knowledge Base")'),
    ]);

    // Verify download happened
    expect(download.suggestedFilename()).toContain('passdown');

    // Read the downloaded file
    const path = await download.path();
    const fs = require('fs');
    const exported = JSON.parse(fs.readFileSync(path, 'utf8'));
    expect(exported.entries.length).toBe(1);
    expect(exported.entries[0].title).toBe('Round Trip Entry');
  });
});
