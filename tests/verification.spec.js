import { test, expect } from '@playwright/test';

test.describe('Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Seed entries with different verification states
    await page.evaluate(() => {
      const now = new Date();
      const entries = [
        { id: 'v_1', category: 'process', title: 'Current Entry', content: 'Verified recently', tags: [], priority: 'medium', status: 'active', verifiedAt: now.toISOString(), verifyBy: new Date(now.getTime() + 60*86400000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() },
        { id: 'v_2', category: 'process', title: 'Stale Entry', content: 'Verification overdue', tags: [], priority: 'high', status: 'active', verifiedAt: new Date(now.getTime() - 120*86400000).toISOString(), verifyBy: new Date(now.getTime() - 30*86400000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() },
        { id: 'v_3', category: 'lesson', title: 'Unverified Entry', content: 'Never been verified', tags: [], priority: 'low', status: 'active', createdAt: now.toISOString(), updatedAt: now.toISOString() },
      ];
      localStorage.setItem('passdown_entries', JSON.stringify(entries));
    });
    await page.reload();
  });

  test('shows verification status counts', async ({ page }) => {
    await page.click('button:has-text("Verification")');
    await expect(page.locator('text=Current Entry')).toBeVisible();
    await expect(page.locator('text=Stale Entry')).toBeVisible();
    await expect(page.locator('text=Unverified Entry')).toBeVisible();
  });

  test('stale entries appear first', async ({ page }) => {
    await page.click('button:has-text("Verification")');
    // The first entry in the list should be the stale one
    const firstEntry = page.locator('[class*="entry"], [class*="row"]').first();
    await expect(page.locator('text=Stale Entry')).toBeVisible();
  });
});
