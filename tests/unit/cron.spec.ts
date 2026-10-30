import { describe, expect, it, vi } from 'vitest'
import { fromTheCron } from '../../server/utils/cron'

/**
 * The cron itself, as production is built with it: Nitro's Vercel preset writes
 * what `nitro.vercel.config` says into the Build Output's `config.json`, which
 * is where Vercel reads a deployment's crons from. Read out of the Nuxt
 * configuration with `defineNuxtConfig` standing for itself.
 */
describe('the cron', () => {
  it('calls the sweep once a day', async () => {
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    const { default: config } = await import('../../nuxt.config')
    vi.unstubAllGlobals()

    const crons = config.nitro?.vercel?.config?.crons
    expect(crons).toHaveLength(1)
    const [{ path, schedule }] = crons!
    expect(path).toBe('/api/sweep')
    // Minute, hour, and every day of every month on every day of the week.
    expect(schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/)
  })
})

/**
 * Whether a call to the daily sweep is the cron's own: the one carrying
 * `Authorization: Bearer` and the secret Vercel holds. Read here rather than
 * through the built app, because the one case the suite's server cannot be in
 * is the one that matters most — an instance where no secret is set at all,
 * which must refuse every call rather than take an empty one for the secret.
 */
describe('a call to the sweep', () => {
  it('is the cron’s when it carries the secret', () => {
    expect(fromTheCron('Bearer frameline-cron', 'frameline-cron')).toBe(true)
  })

  it('is refused without the secret, with another one, or without its scheme', () => {
    expect(fromTheCron(undefined, 'frameline-cron')).toBe(false)
    expect(fromTheCron('Bearer frameline-cro', 'frameline-cron')).toBe(false)
    expect(fromTheCron('Bearer frameline-cron-and-more', 'frameline-cron')).toBe(false)
    expect(fromTheCron('frameline-cron', 'frameline-cron')).toBe(false)
  })

  it('is refused, every one of them, while no secret is set', () => {
    expect(fromTheCron(undefined, undefined)).toBe(false)
    expect(fromTheCron('Bearer ', '')).toBe(false)
    expect(fromTheCron('Bearer undefined', undefined)).toBe(false)
    expect(fromTheCron('Bearer ', undefined)).toBe(false)
  })
})
