import { test, expect } from '@playwright/test'

test('protected driver workspace redirects anonymous users to sign in', async ({ page }) => {
  await page.goto('/driver/dashboard')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
})
