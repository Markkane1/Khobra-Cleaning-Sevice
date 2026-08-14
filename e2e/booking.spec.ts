import { test, expect } from '@playwright/test'

test('homepage opens the public booking page on desktop and mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Book a service' }).click()
  await expect(page).toHaveURL(/\/book$/)
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByText('No account is required.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Sign up free/i })).toHaveAttribute('href', '/signup')
  await expect(page.getByText('You can still complete this booking as a guest.')).toBeVisible()
})

test('about page provides a clear path to guest booking', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: /Professional cleaning for homes and workplaces/i })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Book a service' })).toHaveAttribute('href', '/book')
  await expect(page.getByText('Book as a guest now')).toBeVisible()
})
