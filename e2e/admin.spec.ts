import { test, expect } from '@playwright/test'

test.describe('Protected admin navigation', () => {
  for (const path of ['/expenses', '/dispatch', '/attendance', '/complaints', '/finance']) {
    test(`redirects an unauthenticated request for ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
    })
  }
})
