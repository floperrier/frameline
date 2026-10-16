import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { bringSoundIn, letGo, playable, untilShown } from '../../app/utils/brought'

/**
 * The Sounds a Reading brings in ahead, held as bytes the document keeps. See
 * `docs/adr/0073-a-beat-lands-when-its-image-can-be-shown.md`. The door is a
 * stubbed `fetch`, so what is proved is what is done with whatever it answers.
 */
describe('the Sounds a Reading brings in', () => {
  afterEach(() => {
    letGo()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const answering = () => vi.fn(async () => new Response(new Blob(['bytes'], { type: 'audio/mpeg' })))

  it('brings an address in once, and plays it from its bytes once they are in', async () => {
    const door = answering()
    vi.stubGlobal('fetch', door)

    const ready = bringSoundIn('/strike')
    expect(bringSoundIn('/strike')).toBe(ready)
    expect(playable('/strike')).toBe('/strike')

    await ready
    expect(door).toHaveBeenCalledTimes(1)
    expect(playable('/strike')).toMatch(/^blob:/)
  })

  it('settles a fetch that fails or is refused, and plays the address instead', async () => {
    vi.stubGlobal('fetch', vi.fn(async (address: string) => {
      if (address === '/aborted') throw new TypeError('Failed to fetch')
      return new Response(null, { status: 404 })
    }))

    await expect(bringSoundIn('/aborted')).resolves.toBeUndefined()
    await expect(bringSoundIn('/gone')).resolves.toBeUndefined()
    expect(playable('/aborted')).toBe('/aborted')
    expect(playable('/gone')).toBe('/gone')
  })

  it('asks again on the next call for a Sound whose fetch failed', async () => {
    const door = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(new Blob(['bytes'])))
    vi.stubGlobal('fetch', door)

    const failed = bringSoundIn('/strike')
    await expect(failed).resolves.toBeUndefined()
    expect(playable('/strike')).toBe('/strike')

    const again = bringSoundIn('/strike')
    expect(again).not.toBe(failed)
    await again
    expect(door).toHaveBeenCalledTimes(2)
    expect(playable('/strike')).toMatch(/^blob:/)
  })

  it('waits on a Sound that is not in yet, and on nothing once it is', async () => {
    let answer = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((done) => {
      answer = () => done(new Response(new Blob(['bytes'])))
    })))
    const slow = ref(false)

    const waiting = untilShown(null, slow, ['/bed'])
    expect(waiting).toBeInstanceOf(Promise)
    answer()
    await waiting

    expect(untilShown(null, slow, ['/bed'])).toBeUndefined()
    expect(untilShown(null, slow, [])).toBeUndefined()
  })

  it('revokes everything it holds as the Reading lets go, and holds nothing after', async () => {
    vi.stubGlobal('fetch', answering())
    await bringSoundIn('/bed')
    const held = playable('/bed')
    const revoked = vi.spyOn(URL, 'revokeObjectURL')

    letGo()

    expect(revoked).toHaveBeenCalledWith(held)
    expect(playable('/bed')).toBe('/bed')
  })

  it('makes nothing of bytes that arrive after the Reading has let go', async () => {
    let answer = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((done) => {
      answer = () => done(new Response(new Blob(['bytes'])))
    })))
    const made = vi.spyOn(URL, 'createObjectURL')

    const ready = bringSoundIn('/late')
    letGo()
    answer()
    await ready

    expect(made).not.toHaveBeenCalled()
  })
})
