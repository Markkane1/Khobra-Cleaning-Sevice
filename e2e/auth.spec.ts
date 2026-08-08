import { test, expect } from '@playwright/test'

test.describe('Authentication smoke tests', () => {
  test('skip link works and malformed login input is rejected', async ({ page, request }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const skipLink = page.getByRole('link', { name: 'Skip to main content' })
    await skipLink.focus()
    await expect(skipLink).toBeVisible()
    await skipLink.press('Enter')
    await expect(page.locator('#main-content')).toBeFocused()

    const response = await request.post('/api/khobra-cleaning/auth/login', {
      data: '{',
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status()).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request data' })
  })

  test('login form exposes usable credential controls', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeEditable()
    await expect(page.getByLabel(/password/i)).toBeEditable()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('protected route redirects an anonymous browser', async ({ page }) => {
    await page.goto('/admin/finance')
    await expect(page).toHaveURL(/\/login$/)
  })
})
