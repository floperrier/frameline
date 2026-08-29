import { expect, test } from '@playwright/test'

test('a signed-out Author is offered both ways to sign in', async ({ page }) => {
  await page.goto('/')

  // Each door is on the page twice — beside the pitch and again at the foot — so
  // the first of each pair is the one the opening screen offers.
  await expect(page.getByRole('link', { name: 'Sign in with GitHub' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in with Google' }).first()).toBeVisible()
})

/**
 * The landing page explaining itself: the opening screen a visitor is shown
 * before they scroll, the five structural terms below it, and the doors again at
 * the foot so being convinced on the way down is enough.
 *
 * Which Story the Reading link points at is configuration —
 * `NUXT_PUBLIC_LANDING_STORY` — and nothing publishes a Story into the branch
 * this suite runs against, so the variable is unset here and the case asserted
 * is the one that matters: no link at all rather than a dead one.
 */
test('a visitor reads what a Story is made of, and finds the doors again at the foot', async ({
  page,
}) => {
  await page.goto('/')

  // The opening still fills the screen on its own: the terms below it are past
  // the fold rather than in it.
  const firstTerm = page.getByRole('heading', { name: 'Story', exact: true })
  await expect(firstTerm).not.toBeInViewport()

  for (const term of ['Story', 'Scene', 'Shot', 'Exit', 'Condition']) {
    await expect(page.getByRole('heading', { name: term, exact: true })).toBeVisible()
  }

  // The specimen is still a specimen: an Exit in it is text on the page and not
  // anything a visitor can take.
  await expect(page.getByText('Cross to the bar')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cross to the bar' })).toHaveCount(0)

  // No Story is named for this deployment, so there is nothing to read yet and
  // nothing pretending there is.
  await expect(page.getByRole('link', { name: /on the engine a Reader runs/ })).toHaveCount(0)

  // Two of each door now, and the second pair is under everything said to
  // convince anyone of it.
  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toHaveCount(2)

  // The Catalogue is its own page, and this is how somebody with no account
  // reaches it: the landing page points at it rather than showing it.
  await page.getByRole('link', { name: 'Read what other Authors have listed' }).click()
  await expect(page).toHaveURL('/catalogue')
  await expect(page.getByRole('heading', { name: 'Catalogue' })).toBeVisible()
})

test('Stories are not reachable without a signed-in Author', async ({ page }) => {
  await page.goto('/stories')

  await expect(page).toHaveURL('/')
})
