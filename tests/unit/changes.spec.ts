import { describe, expect, it } from 'vitest'
import { changesSince } from '../../shared/utils/changes'
import type { Edition } from '../../shared/utils/reading'

/**
 * What differs between Readers' Edition of a Story and the Story as it is written,
 * counted by Scene — the unit an Author thinks of their Story in.
 */

/**
 * Recursively reverses the keys of an object, to test that the comparison works
 * regardless of key order (since jsonb keeps its own key order).
 */
function reverseKeys(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(reverseKeys)

  const entries = Object.entries(value as Record<string, unknown>)
  return Object.fromEntries(entries.reverse().map(([k, v]) => [k, reverseKeys(v)]))
}

/**
 * A fixture factory that casts through unknown to create Edition-shaped objects
 * with minimal fields.
 */
const fixture = (): Edition => ({
  openingSceneId: 'a',
  stepsBack: true,
  textFace: 'prose',
  textAlign: 'start',
  scenes: [
    {
      id: 'a',
      name: 'Scene A',
      shots: [
        {
          id: 'shot-a1',
          text: 'First shot',
          position: 0,
          image: '/api/read/s/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          conditions: [],
        },
        {
          id: 'shot-a2',
          text: 'Second shot',
          position: 1,
          image: '/api/read/s/media/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          conditions: [],
        },
      ],
    } as unknown,
    {
      id: 'b',
      name: 'Scene B',
      shots: [],
    } as unknown,
  ] as unknown as Edition['scenes'],
  exits: [
    {
      id: 'exit-a-to-b',
      fromSceneId: 'a',
      toSceneId: 'b',
      text: 'Go to B',
      position: 0,
      conditions: [],
    } as unknown,
  ] as unknown as Edition['exits'],
} as unknown as Edition)

describe('changesSince — what differs between an Edition and the Story as written', () => {
  it('returns no changes when the inputs are equal', () => {
    const ed = fixture()
    const result = changesSince(ed, structuredClone(ed))
    expect(result).toEqual({ story: false, added: [], changed: [], gone: 0 })
  })

  it('returns no changes when the Story is the same with keys in reverse order', () => {
    const ed = fixture()
    const live = structuredClone(ed)
    const reversed = reverseKeys(live) as Edition
    expect(changesSince(ed, reversed)).toEqual({ story: false, added: [], changed: [], gone: 0 })
  })

  it("detects when a Shot's text changed", () => {
    const ed = fixture()
    const live = structuredClone(ed)
    ;(live.scenes[0].shots as any)[0].text = 'Changed text'
    expect(changesSince(ed, live)).toEqual({ story: false, added: [], changed: ['a'], gone: 0 })
  })

  it("detects when a Shot's image digest changed", () => {
    const ed = fixture()
    const live = structuredClone(ed)
    ;(live.scenes[0].shots as any)[0].image =
      '/api/read/s/media/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    expect(changesSince(ed, live)).toEqual({ story: false, added: [], changed: ['a'], gone: 0 })
  })

  it("detects when a Shot's conditions changed", () => {
    const ed = fixture()
    const live = structuredClone(ed)
    ;(live.scenes[0].shots as any)[0].conditions = [{ flag: 'test', is: 'value' }]
    expect(changesSince(ed, live)).toEqual({ story: false, added: [], changed: ['a'], gone: 0 })
  })

  it('detects when a Shot moved down (array order and position swapped)', () => {
    const ed = fixture()
    const live = structuredClone(ed)
    const [first, second] = live.scenes[0].shots as any[]
    first.position = 1
    second.position = 0
    live.scenes[0].shots = [second, first] as any
    expect(changesSince(ed, live)).toEqual({ story: false, added: [], changed: ['a'], gone: 0 })
  })

  it('returns no change when a Shot moved back to the original position', () => {
    const ed = fixture()
    const live = structuredClone(ed)
    live.scenes[0].shots = structuredClone(ed.scenes[0].shots)
    expect(changesSince(ed, live)).toEqual({ story: false, added: [], changed: [], gone: 0 })
  })

  // The builders a Sample is planted with leave a text's attributes out, and the
  // editor writes each one it holds, null where the text is as the Story sets it:
  // the same words typed back are no change, and an attribute that says something is.
  it('reads attributes that hold nothing as attributes left out', () => {
    const ed = fixture()
    const typed = (attrs: object) => ({
      type: 'doc',
      attrs: { stands: null },
      content: [{ type: 'line', attrs, content: [{ type: 'text', text: 'First shot' }] }],
    })
    ;(ed.scenes[0].shots as any)[0].formatted = {
      type: 'doc',
      content: [{ type: 'line', content: [{ type: 'text', text: 'First shot' }] }],
    }
    const live = structuredClone(ed)
    ;(live.scenes[0].shots as any)[0].formatted = typed({ align: null, leading: null })
    expect(changesSince(ed, live)).toEqual({ story: false, added: [], changed: [], gone: 0 })

    ;(live.scenes[0].shots as any)[0].formatted = typed({ align: 'centre', leading: null })
    expect(changesSince(ed, live)).toEqual({ story: false, added: [], changed: ['a'], gone: 0 })
  })

  it('detects when an Exit is added', () => {
    const ed = fixture()
    const live = structuredClone(ed)
    ;(live.exits as any).push({
      id: 'exit-b-to-a',
      fromSceneId: 'b',
      toSceneId: 'a',
      text: 'Go back to A',
      position: 0,
      conditions: [],
    })
    expect(changesSince(ed, live)).toEqual({ story: false, added: [], changed: ['b'], gone: 0 })
  })

  it('detects when a Scene is added', () => {
    const ed = fixture()
    const live = structuredClone(ed)
    ;(live.scenes as any).push({
      id: 'c',
      name: 'Scene C',
      shots: [],
    })
    expect(changesSince(ed, live)).toEqual({ story: false, added: ['c'], changed: [], gone: 0 })
  })

  it('detects when a Scene is removed', () => {
    const ed = fixture()
    const live = structuredClone(ed)
    live.scenes = live.scenes.slice(0, 1)
    live.exits = []
    expect(changesSince(ed, live)).toEqual({ story: false, added: [], changed: ['a'], gone: 1 })
  })

  it('detects when the openingSceneId changes', () => {
    const ed = fixture()
    const live = structuredClone(ed)
    live.openingSceneId = 'b'
    expect(changesSince(ed, live)).toEqual({ story: true, added: [], changed: [], gone: 0 })
  })

  it('detects when stepsBack changes', () => {
    const ed = fixture()
    const live = structuredClone(ed)
    live.stepsBack = false
    expect(changesSince(ed, live)).toEqual({ story: true, added: [], changed: [], gone: 0 })
  })

  it('detects when textFace changes', () => {
    const ed = fixture()
    const live = structuredClone(ed)
    live.textFace = 'lines'
    expect(changesSince(ed, live)).toEqual({ story: true, added: [], changed: [], gone: 0 })
  })

  it('detects when textAlign changes', () => {
    const ed = fixture()
    const live = structuredClone(ed)
    live.textAlign = 'end'
    expect(changesSince(ed, live)).toEqual({ story: true, added: [], changed: [], gone: 0 })
  })
})
