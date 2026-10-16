import { describe, expect, it } from 'vitest'
import { effect, reactive, toRaw } from 'vue'
import { keep, sharing, steady } from '../../app/utils/sharing'

/**
 * A Story read back is laid over the Story the bench holds so that whatever did
 * not change keeps the object it had — issue #449. Read as JSON every time, so each
 * case builds the read afresh rather than handing the held Story back to itself.
 */
const held = () => ({
  id: 'story',
  title: 'A Story',
  scenes: [
    { id: 'street', name: 'The street', sets: { lit: true }, shots: [
      { id: 'door', text: 'A door opens.', formatted: [{ type: 'paragraph', content: [{ type: 'text', text: 'A door opens.' }] }] },
      { id: 'step', text: 'She steps out.', formatted: null },
    ] },
    { id: 'bar', name: 'The bar', sets: {}, shots: [{ id: 'smoke', text: 'Smoke.', formatted: null }] },
  ],
  exits: [{ id: 'out', fromSceneId: 'street', toSceneId: 'bar', conditions: [] }],
})

const read = (change: (story: ReturnType<typeof held>) => void = () => {}) => {
  const story = held()
  change(story)
  return JSON.parse(JSON.stringify(story)) as ReturnType<typeof held>
}

describe('sharing', () => {
  it('hands back what the bench holds where nothing changed', () => {
    const holding = held()

    expect(sharing(holding, read())).toBe(holding)
  })

  it('takes what changed from the read, and keeps the object of everything else', () => {
    const holding = held()
    const kept = sharing(holding, read(story => (story.scenes[0]!.shots[1]!.text = 'She runs.')))

    expect(kept).not.toBe(holding)
    expect(kept.scenes).not.toBe(holding.scenes)
    expect(kept.scenes[0]).not.toBe(holding.scenes[0])
    expect(kept.scenes[0]!.shots[1]).not.toBe(holding.scenes[0]!.shots[1])
    expect(kept.scenes[0]!.shots[1]!.text).toBe('She runs.')

    expect(kept.scenes[0]!.shots[0]).toBe(holding.scenes[0]!.shots[0])
    expect(kept.scenes[0]!.sets).toBe(holding.scenes[0]!.sets)
    expect(kept.scenes[1]).toBe(holding.scenes[1])
    expect(kept.exits).toBe(holding.exits)
    expect(kept.title).toBe('A Story')
  })

  // A typed write still waiting in the queue holds the object it was typed into,
  // and sends what that object says: it must still say what was typed.
  it('never writes into what the bench holds', () => {
    const holding = held()
    holding.scenes[0]!.shots[1]!.text = 'She steps out, typed.'
    const before = JSON.stringify(holding)

    sharing(holding, read())

    expect(JSON.stringify(holding)).toBe(before)
  })

  it('finds a row by its id wherever the read puts it', () => {
    const holding = held()
    const kept = sharing(holding, read(story => story.scenes[0]!.shots.reverse()))

    expect(kept.scenes[0]!.shots.map(shot => shot.id)).toEqual(['step', 'door'])
    expect(kept.scenes[0]!.shots[0]).toBe(holding.scenes[0]!.shots[1])
    expect(kept.scenes[0]!.shots[1]).toBe(holding.scenes[0]!.shots[0])
  })

  it('keeps every row a Shot added or taken away leaves standing', () => {
    const holding = held()
    const added = sharing(holding, read(story => story.scenes[1]!.shots.push(
      { id: 'glass', text: 'A glass.', formatted: null })))

    expect(added.scenes[0]).toBe(holding.scenes[0])
    expect(added.scenes[1]!.shots[0]).toBe(holding.scenes[1]!.shots[0])
    expect(added.scenes[1]!.shots[1]!.id).toBe('glass')

    const taken = sharing(holding, read(story => story.scenes[0]!.shots.shift()))
    expect(taken.scenes[0]!.shots).toEqual([holding.scenes[0]!.shots[1]])
    expect(taken.scenes[0]!.shots[0]).toBe(holding.scenes[0]!.shots[1])
  })

  it('takes a changed Scene or Exit from the read, and keeps the rest', () => {
    const holding = held()
    const renamed = sharing(holding, read(story => (story.scenes[1]!.name = 'The pub')))

    expect(renamed.scenes[1]).not.toBe(holding.scenes[1])
    expect(renamed.scenes[1]!.name).toBe('The pub')
    expect(renamed.scenes[1]!.shots).toBe(holding.scenes[1]!.shots)
    expect(renamed.scenes[0]).toBe(holding.scenes[0])
    expect(renamed.exits).toBe(holding.exits)

    const landed = sharing(holding, read(story => (story.exits[0]!.toSceneId = 'street')))
    expect(landed.exits[0]).not.toBe(holding.exits[0])
    expect(landed.exits[0]!.toSceneId).toBe('street')
    expect(landed.scenes).toBe(holding.scenes)
  })

  it('takes away a Scene or an Exit the read no longer holds, and adds one it holds anew', () => {
    const holding = held()
    const gone = sharing(holding, read(story => {
      story.scenes.splice(1, 1)
      story.exits = []
    }))

    expect(gone.scenes.map(scene => scene.id)).toEqual(['street'])
    expect(gone.scenes[0]).toBe(holding.scenes[0])
    expect(gone.exits).toEqual([])

    const drawn = sharing(holding, read(story => story.exits.push(
      { id: 'back', fromSceneId: 'bar', toSceneId: 'street', conditions: [] })))
    expect(drawn.exits.map(exit => exit.id)).toEqual(['out', 'back'])
    expect(drawn.exits[0]).toBe(holding.exits[0])
    expect(drawn.exits[1]!.toSceneId).toBe('street')
  })

  it('puts the rows in the order the read gives them', () => {
    const holding = held()
    const turned = sharing(holding, read(story => story.scenes.reverse()))

    expect(turned.scenes.map(scene => scene.id)).toEqual(['bar', 'street'])
    expect(turned.scenes[0]).toBe(holding.scenes[1])
    expect(turned.scenes[1]).toBe(holding.scenes[0])
  })

  it('reads what carries no id by where it stands', () => {
    const holding = held()
    const kept = sharing(holding, read(story => (story.scenes[0]!.shots[0]!.formatted![0]!.content![0]!.text = 'A door.')))

    expect(kept.scenes[0]!.shots[0]!.formatted![0]!.content![0]!.text).toBe('A door.')
    expect(kept.scenes[0]!.shots[1]).toBe(holding.scenes[0]!.shots[1])
  })

  it('takes a key the read no longer carries away', () => {
    const holding = held() as ReturnType<typeof held> & { publishedAt?: string }
    holding.publishedAt = 'yesterday'

    expect(sharing(holding, read())).not.toBe(holding)
    expect('publishedAt' in sharing(holding, read())).toBe(false)
  })
})

/**
 * What the document works out of the whole Story after every act is handed back as
 * the value it held where it says the same, so every row handed it is handed the
 * very object it had.
 */
describe('steady', () => {
  it('takes the value worked out the first time', () => {
    const named = new Map([['street', 'The street']])

    expect(steady(undefined, named)).toBe(named)
  })

  it('keeps a Map holding the same entries, and takes one that holds others', () => {
    const before = new Map([['out', { place: 1, scene: 'The bar' }]])

    expect(steady(before, new Map([['out', { place: 1, scene: 'The bar' }]]))).toBe(before)

    const renamed = new Map([['out', { place: 1, scene: 'The pub' }]])
    expect(steady(before, renamed)).toBe(renamed)
    const grown = new Map([...before, ['in', { place: 1, scene: 'The street' }]])
    expect(steady(before, grown)).toBe(grown)
  })

  it('keeps a Set holding the same members, and takes one that holds others', () => {
    const before = new Set(['lit', 'coat'])

    expect(steady(before, new Set(['lit', 'coat']))).toBe(before)
    const fewer = new Set(['lit'])
    expect(steady(before, fewer)).toBe(fewer)
  })

  // The order a Map or a Set is read in is the order a list of it offers — the
  // Scenes a Condition asks about, the Flags its field suggests — so the same
  // entries in another order are another value.
  it('takes a Map or a Set holding the same in another order', () => {
    const before = new Map([['street', 'The street'], ['bar', 'The bar']])
    const reordered = new Map([['bar', 'The bar'], ['street', 'The street']])
    expect(steady(before, reordered)).toBe(reordered)

    const flags = new Set(['lit', 'coat'])
    const turned = new Set(['coat', 'lit'])
    expect(steady(flags, turned)).toBe(turned)
  })

  it('compares anything else as a value', () => {
    const before = { class: undefined, style: { '--shot-face': 'var(--serif)' } }

    expect(steady(before, { class: undefined, style: { '--shot-face': 'var(--serif)' } })).toBe(before)
    const moved = { class: 'align-center', style: { '--shot-face': 'var(--serif)' } }
    expect(steady(before, moved)).toBe(moved)
  })
})

/**
 * What the document hands every row once and keeps up to date in place: an entry
 * that changed is written over, one that did not is left as the object it was, and
 * the Map or the Set is the same object throughout. Read through Vue's `reactive`
 * as the document reads it, so what is asserted is also what a row reading one
 * entry is told: nothing, where its entry did not change.
 */
describe('keep', () => {
  it('writes over the entry that changed and leaves the others as they were', () => {
    const out = { place: 1, scene: 'The bar', text: 'Go' }
    const back = { place: 1, scene: 'The street', text: 'Back' }
    const held = new Map([['out', out], ['back', back]])

    keep(held, new Map([['out', { ...out, text: 'Go in' }], ['back', { ...back }]]))

    expect([...held.keys()]).toEqual(['out', 'back'])
    expect(held.get('out')).toEqual({ place: 1, scene: 'The bar', text: 'Go in' })
    expect(held.get('back')).toBe(back)
  })

  it('tells a reader of an entry that did not change nothing', () => {
    const held = reactive(new Map([['out', 'Go'], ['back', 'Back']]))
    const readings = { out: 0, back: 0 }
    const stops = (['out', 'back'] as const).map(key => effect(() => {
      held.get(key)
      readings[key]++
    }))

    keep(held, new Map([['out', 'Go in'], ['back', 'Back']]))

    expect(readings).toEqual({ out: 2, back: 1 })
    for (const stop of stops) stop.effect.stop()
  })

  it('fills it again in the order it now holds, where the entries are others or in another order', () => {
    const held = new Map([['street', 'The street'], ['bar', 'The bar']])

    keep(held, new Map([['bar', 'The bar'], ['street', 'The street']]))
    expect([...held]).toEqual([['bar', 'The bar'], ['street', 'The street']])

    keep(held, new Map([['bar', 'The bar']]))
    expect([...held]).toEqual([['bar', 'The bar']])
  })

  // A keystroke into an Exit's words changes one field of one entry. Written over
  // inside the object the Map holds, no key is set, so what walks the Map or reads
  // its size — every list of Conditions reads whether there is an Exit to ask
  // about — is told nothing.
  it('writes over a plain entry inside the object it holds, and tells only the reader of the field', () => {
    const out = { place: 1, scene: 'The bar', text: 'Go' }
    const held = reactive(new Map([['out', out], ['back', { place: 1, scene: 'The street', text: 'Back' }]]))
    const readings = { size: 0, walked: 0, text: 0, back: 0 }
    const stops = [
      effect(() => (held.size, readings.size++)),
      effect(() => ([...held.keys()], readings.walked++)),
      effect(() => (held.get('out')!.text, readings.text++)),
      effect(() => (held.get('back')!.text, readings.back++)),
    ]

    keep(held, new Map([
      ['out', { place: 1, scene: 'The bar', text: 'Go in' }],
      ['back', { place: 1, scene: 'The street', text: 'Back' }],
    ]))

    expect(readings).toEqual({ size: 1, walked: 1, text: 2, back: 1 })
    expect(held.get('out')!.text).toBe('Go in')
    expect(toRaw(held).get('out')).toBe(out)
    for (const stop of stops) stop.effect.stop()
  })

  it('keeps a Set holding the same members, and tells no reader anything', () => {
    const held = reactive(new Set(['lit', 'coat']))
    let readings = 0
    const stop = effect(() => {
      held.has('lit')
      readings++
    })

    keep(held, new Set(['lit', 'coat']))
    expect(readings).toBe(1)
    stop.effect.stop()
  })

  it('puts a member held anew at the end, and tells a reader of another member nothing', () => {
    const held = reactive(new Set(['lit', 'coat']))
    const readings = { lit: 0, hat: 0, walked: 0 }
    const read: Record<string, boolean> = {}
    const stops = [
      effect(() => (read.lit = held.has('lit'), readings.lit++)),
      effect(() => (read.hat = held.has('hat'), readings.hat++)),
      effect(() => ([...held], readings.walked++)),
    ]

    keep(held, new Set(['lit', 'coat', 'hat']))

    expect([...held]).toEqual(['lit', 'coat', 'hat'])
    expect(held.has('hat')).toBe(true)
    expect(held.size).toBe(3)
    expect(read).toEqual({ lit: true, hat: true })
    expect(readings).toEqual({ lit: 1, hat: 2, walked: 2 })
    for (const stop of stops) stop.effect.stop()
  })

  // A Flag typed into is one member taken out and another put in, where the old
  // one stood: what stands before it is not touched, what stands after it is put
  // back after it, so the order stays the order the Story declares them in.
  it('takes out a member no longer held and puts the new one where it falls', () => {
    const held = reactive(new Set(['lit', 'wa', 'coat']))
    const readings = { lit: 0, wa: 0, way: 0, coat: 0 }
    const stops = (['lit', 'wa', 'way', 'coat'] as const).map(member => effect(() => {
      held.has(member)
      readings[member]++
    }))

    keep(held, new Set(['lit', 'way', 'coat']))

    expect([...held]).toEqual(['lit', 'way', 'coat'])
    expect([held.has('wa'), held.has('way')]).toEqual([false, true])
    expect(readings.lit).toBe(1)
    expect(readings.wa).toBe(2)
    expect(readings.way).toBe(2)
    for (const stop of stops) stop.effect.stop()

    keep(held, new Set(['lit']))
    expect([...held]).toEqual(['lit'])
  })
})
