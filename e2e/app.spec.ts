import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/TEC/);
});

test('login button visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Continue with Pi')).toBeVisible();
});
