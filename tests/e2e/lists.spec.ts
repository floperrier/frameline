import { expect, test } from '@playwright/test'

const anyListId = '00000000-0000-4000-8000-000000000000'
const anyStoryId = '00000000-0000-4000-8000-000000000001'

/**
 * Somebody with no account, in the Catalogue: they are offered no control and
 * told why, and nothing sends them anywhere — they came to find something to
 * read. This browser has never had a session, because the spec does not use the
 * Author fixture at all.
 */
test('somebody with no account is not offered the control, and is told why', async ({ page }) => {
  await page.goto('/catalogue')

  await expect(page.getByText(
    'Favourites and Lists are kept per account, so gathering a Story needs one.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Favourite/ })).toHaveCount(0)
  await expect(page.locator('summary')).toHaveCount(0)
  await expect(page).toHaveURL(/\/catalogue$/)
})

/** The Lists page is one Author's own, so there is nothing there to read. */
test('the Lists page is not a page without an account', async ({ page }) => {
  await page.goto('/lists')

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Lists' })).toBeHidden()
})

test('every List route needs an account', async ({ request }) => {
  const refused = await Promise.all([
    request.get('/api/lists'),
    request.post('/api/lists', { data: { title: 'Mine' } }),
    request.patch(`/api/lists/${anyListId}`, { data: { title: 'Mine' } }),
    request.delete(`/api/lists/${anyListId}`),
    request.put(`/api/lists/${anyListId}/stories/${anyStoryId}`),
    request.delete(`/api/lists/${anyListId}/stories/${anyStoryId}`),
  ])

  for (const response of refused) expect(response.status()).toBe(401)
})
