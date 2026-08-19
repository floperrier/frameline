import { expect, test } from '@playwright/test'

test('a visitor is offered both ways to sign in', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible()
})

test('Stories are not reachable without a session', async ({ page }) => {
  await page.goto('/stories')

  await expect(page).toHaveURL('/')
})
