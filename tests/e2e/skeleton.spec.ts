import { expect, test } from '@playwright/test'

test('a signed-out Author is offered both ways to sign in', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible()
})

test('Stories are not reachable without a signed-in Author', async ({ page }) => {
  await page.goto('/stories')

  await expect(page).toHaveURL('/')
})
