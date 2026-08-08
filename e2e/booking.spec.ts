import { test, expect } from '@playwright/test'

test('homepage opens the public booking page on desktop and mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Book a service' }).click()
  await expect(page).toHaveURL(/\/book$/)
  await expect(page.getByRole('main')).toBeVisible()
})
