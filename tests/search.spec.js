import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Seed some entries via localStorage
    await page.evaluate(() => {
      const entries = [
        { id: 'e_1', category: 'process', title: 'Budget Submission Process', content: 'Steps for POM submission', tags: ['budget', 'POM'], priority: 'high', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), verifiedAt: new Date().toISOString(), verifyBy: new Date(Date.now() + 90*86400000).toISOString() },
        { id: 'e_2', category: 'stakeholder', title: 'M&RA Monitor Contact', content: 'Weekly coordination on manning', tags: ['M&RA', 'manning'], priority: 'medium', status: 'active', meta: { billetTitle: 'Monitor, MPP-40', org: 'M&RA', frequency: 'weekly' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'e_3', category: 'lesson', title: 'Never Skip the Staffing Cycle', content: 'Learned the hard way that skipping staffing leads to rejection', tags: ['staffing', 'lesson'], priority: 'high', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
      localStorage.setItem('passdown_entries', JSON.stringify(entries));
    });
    await page.reload();
  });

  test('search finds entries by title', async ({ page }) => {
    await page.click('button:has-text("Search")');
    await page.fill('input[placeholder*="Search"]', 'budget');
    await page.waitForTimeout(500); // debounce
    await expect(page.locator('text=Budget Submission Process')).toBeVisible();
  });

  test('search finds entries by tag', async ({ page }) => {
    await page.click('button:has-text("Search")');
    await page.fill('input[placeholder*="Search"]', 'manning');
    await page.waitForTimeout(500);
    await expect(page.locator('text=M&RA Monitor Contact')).toBeVisible();
  });

  test('search shows no results message', async ({ page }) => {
    await page.click('button:has-text("Search")');
    await page.fill('input[placeholder*="Search"]', 'xyznonexistent');
    await page.waitForTimeout(500);
    await expect(page.locator('text=No entries match')).toBeVisible();
  });
});
