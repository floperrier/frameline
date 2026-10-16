import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { FIND_MAX_LENGTH, placesIn, replacements } from '../../shared/utils/found'
import type { Found } from '../../shared/utils/found'
import { QUESTION_MAX_LENGTH, heldQuestion } from '../../shared/utils/scenes'
import type { Scene } from '../../shared/utils/scenes'
import { DEFAULT_LOCALE, phrase } from '../../server/utils/phrases'
import en from '../../i18n/locales/en.json'

/**
 * What a replacement is asked for, read at the request boundary, and the
 * Question it writes held to the rule the Question's own write holds it to.
 * The readers are server modules, so what they reach for is nitro's own: the
 * body of the request, the caps, and the error they refuse with.
 */
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('createError', (refusal: { statusCode: number, message: string }) =>
  Object.assign(new Error(refusal.message), refusal))
vi.stubGlobal('saying', () => (key: string, values?: Record<string, string | number>) =>
  phrase(DEFAULT_LOCALE, key, values))
vi.stubGlobal('FIND_MAX_LENGTH', FIND_MAX_LENGTH)
vi.stubGlobal('QUESTION_MAX_LENGTH', QUESTION_MAX_LENGTH)
vi.stubGlobal('heldQuestion', heldQuestion)

const { readReplacing } = await import('../../server/utils/replacing')
const { readQuestion } = await import('../../server/utils/scenes')

const asking = (body: unknown) => readReplacing({ body } as unknown as H3Event)
const refusals = en.refusals as Record<string, string>

describe('what a replacement is asked for', () => {
  it('takes a find, a replace that may be empty, and whether case counts', async () => {
    await expect(asking({ find: 'coat', replace: '', matchCase: false }))
      .resolves.toEqual({ find: 'coat', replace: '', matchCase: false })
  })

  it('refuses a replace that is missing or not text by saying so, not by speaking of lines', async () => {
    for (const replace of [undefined, null, 3, ['cloak'], { text: 'cloak' }]) {
      await expect(asking({ find: 'coat', replace, matchCase: false })).rejects.toThrow(refusals.replaceMissing)
      await expect(asking({ find: 'coat', replace, matchCase: false })).rejects.not.toThrow(refusals.findLine)
    }
  })

  it('keeps the phrase about lines for a find or a replace that breaks one', async () => {
    await expect(asking({ find: 'coat', replace: 'a\nb', matchCase: false })).rejects.toThrow(refusals.findLine)
    await expect(asking({ find: 'a\rb', replace: 'c', matchCase: false })).rejects.toThrow(refusals.findLine)
  })
})

function questioning(question: string): Found {
  const scene = { id: 's', name: 'S', sets: {}, shots: [], sound: null, transcript: '', question, questionFlag: '' } as unknown as Scene
  return { scenes: [scene], exits: [], openingSceneId: 's', language: 'en' }
}

describe('the Question a replacement writes', () => {
  const replacedQuestion = (question: string, find: string, replace: string) => {
    const story = questioning(question)
    const [one] = replacements(story, placesIn(story, find, true), replace)
    return one!.value as string
  }

  it('loses the blanks a replacement leaves round it', () => {
    expect(replacedQuestion('Wear the coat?', 'Wear', '')).toBe('the coat?')
    expect(replacedQuestion('Wear the coat', 'coat', ' ')).toBe('Wear the')
  })

  it('is held exactly as the Question\'s own write would hold the same words', async () => {
    for (const [question, find, replace] of [
      ['Wear the coat?', 'Wear', ''],
      ['Wear the coat?', 'coat?', '\t'],
      ['Take it', 'Take', '  Leave'],
      ['Go', 'Go', ' '],
    ] as const) {
      const written = question.replace(find, replace)
      const read = await readQuestion({ body: { question: written } } as unknown as H3Event)
      expect(replacedQuestion(question, find, replace)).toBe(read)
    }
  })
})
