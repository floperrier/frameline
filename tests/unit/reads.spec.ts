import { describe, expect, it } from 'vitest'
import { readsBack } from '../../app/utils/reads'

/**
 * The reads the bench asks for after an act, each answered to the act that asked
 * it — issue #479. Every read here is a promise the case settles by hand, so the
 * order they come back in is the case's to choose.
 */
function bench() {
  const sent: { answer: (read: string) => void, fail: (error: unknown) => void }[] = []
  const landed: { read: string, whole: boolean }[] = []
  const readBack = readsBack(
    () => new Promise<string>((answer, fail) => sent.push({ answer, fail })),
    (read, whole) => landed.push({ read, whole }),
  )

  return { sent, landed, ask: (whole?: boolean) => followed(readBack(whole)) }
}

/** Where an asker's promise stands, followed from the moment it is handed back. */
function followed(promise: Promise<void>) {
  const seen: { state: 'waiting' | 'landed' | 'failed', error?: unknown } = { state: 'waiting' }
  promise.then(() => (seen.state = 'landed'), (error: unknown) => Object.assign(seen, { state: 'failed', error }))
  return seen
}

/** Once everything already settled has run. */
function settle() {
  return new Promise(done => setTimeout(done))
}

describe('readsBack', () => {
  it('lands a read and keeps the promise of whoever asked it', async () => {
    const { sent, landed, ask } = bench()
    const asker = ask()

    sent[0]!.answer('one')
    await settle()

    expect(asker.state).toBe('landed')
    expect(landed).toEqual([{ read: 'one', whole: false }])
  })

  // The defect #483 shipped with: the act whose own read failed was told it had
  // landed, because the older read of another act came back.
  it('fails whoever asked a read that failed, though an older one landed', async () => {
    const { sent, landed, ask } = bench()
    const first = ask()
    const second = ask()
    const unread = new Error('unread')

    sent[0]!.answer('one')
    sent[1]!.fail(unread)
    await settle()

    expect(first.state).toBe('landed')
    expect(second).toEqual({ state: 'failed', error: unread })
    expect(landed.map(({ read }) => read)).toEqual(['one'])
  })

  it('fails whoever asked a read that failed, whichever order they come back in', async () => {
    const { sent, ask } = bench()
    const first = ask()
    const second = ask()
    const unread = new Error('unread')

    sent[1]!.fail(unread)
    sent[0]!.answer('one')
    await settle()

    expect(first.state).toBe('landed')
    expect(second).toEqual({ state: 'failed', error: unread })
  })

  it('answers an older asker with a newer read, without waiting for its own', async () => {
    const { sent, landed, ask } = bench()
    const first = ask()
    const second = ask()

    sent[1]!.answer('two')
    await settle()

    expect(first.state).toBe('landed')
    expect(second.state).toBe('landed')

    sent[0]!.answer('one')
    await settle()
    expect(landed.map(({ read }) => read)).toEqual(['two'])
  })

  it('does not keep a promise before a read as late as it has landed', async () => {
    const { sent, ask } = bench()
    ask()
    const second = ask()

    sent[0]!.answer('one')
    await settle()
    expect(second.state).toBe('waiting')

    sent[1]!.answer('two')
    await settle()
    expect(second.state).toBe('landed')
  })

  it('keeps an asker waiting while a newer read can still answer it', async () => {
    const { sent, ask } = bench()
    const first = ask()
    ask()
    const last = new Error('last')

    sent[0]!.fail(new Error('first'))
    await settle()
    expect(first.state).toBe('waiting')

    sent[1]!.fail(last)
    await settle()
    expect(first).toEqual({ state: 'failed', error: last })
  })

  it('puts the first read to land after a refusal in place whole', async () => {
    const { sent, landed, ask } = bench()
    ask()
    ask(true)
    ask()
    ask()

    sent[0]!.answer('one')
    sent[2]!.answer('three')
    sent[3]!.answer('four')
    await settle()

    expect(landed).toEqual([
      { read: 'one', whole: true },
      { read: 'three', whole: true },
      { read: 'four', whole: false },
    ])
  })

  it('takes a land that throws for a read that failed', async () => {
    const thrown = new Error('thrown')
    const readBack = readsBack(
      () => Promise.resolve('one'),
      () => {
        throw thrown
      },
    )

    await expect(readBack()).rejects.toBe(thrown)
  })
})
