import { describe, expect, test } from 'vitest'
import type { Cut, Scene } from '../../shared/utils/scenes'
import { cutLine, cutLineTo, NODE_WIDTH, scenesACutMayLandOn } from '../../shared/utils/scenes'

describe('the line that draws a Cut', () => {
  test('leaves the side of the node it leaves, and lands on the side it lands on', () => {
    const line = cutLine({ x: 0, y: 0, height: 100 }, { x: 360, y: 0, height: 100 })

    expect(line).toEqual({ from: { x: NODE_WIDTH, y: 50 }, to: { x: 360, y: 50 } })
  })

  test('leaves the foot of a node it drops to, and the head of one it rises to', () => {
    const above = { x: 0, y: 0, height: 100 }
    const below = { x: 0, y: 300, height: 60 }

    expect(cutLine(above, below)).toEqual({ from: { x: 160, y: 100 }, to: { x: 160, y: 300 } })
    expect(cutLine(below, above)).toEqual({ from: { x: 160, y: 300 }, to: { x: 160, y: 100 } })
  })

  test('reads the height each node is really drawn at', () => {
    const rising = { x: 0, y: 800, height: 90 }

    // The same Cut, rising into a node the Author has open and into one they have
    // folded: it meets the foot of each, which is not the same place.
    expect(cutLine(rising, { x: 0, y: 0, height: 420 }).to.y).toBe(420)
    expect(cutLine(rising, { x: 0, y: 0, height: 90 }).to.y).toBe(90)
  })

  test('is no line at all between two nodes dropped on the same spot', () => {
    const line = cutLine({ x: 40, y: 60, height: 90 }, { x: 40, y: 60, height: 90 })

    expect(line.from).toEqual(line.to)
  })
})

describe('the line of a Cut being drawn', () => {
  test('leaves the edge of the node it is drawn from, and ends at the hand', () => {
    const line = cutLineTo({ x: 0, y: 0, height: 100 }, { x: 600, y: 50 })

    expect(line).toEqual({ from: { x: NODE_WIDTH, y: 50 }, to: { x: 600, y: 50 } })
  })

  test('ends at the hand exactly, even where the hand is inside the node it left', () => {
    const inside = { x: 40, y: 40 }

    expect(cutLineTo({ x: 0, y: 0, height: 100 }, inside).to).toBe(inside)
  })
})

describe('the Scenes a Cut may land on', () => {
  const scene = (id: string) => ({ id }) as Scene
  const cut = (fromSceneId: string, toSceneId: string) => ({ fromSceneId, toSceneId }) as Cut
  const scenes = ['arrival', 'platform', 'bar'].map(scene)

  test('is every other Scene in the Story, where nothing has been drawn yet', () => {
    expect(scenesACutMayLandOn(scenes, [], 'arrival')).toEqual(new Set(['platform', 'bar']))
  })

  test('never holds the Scene the Cut leaves, so the hand cannot slip into a Cut on itself', () => {
    expect(scenesACutMayLandOn(scenes, [], 'bar').has('bar')).toBe(false)
  })

  test('drops a Scene the departing Scene already reaches', () => {
    const drawn = [cut('arrival', 'platform')]

    expect(scenesACutMayLandOn(scenes, drawn, 'arrival')).toEqual(new Set(['bar']))
  })

  test('counts only the Cuts leaving this Scene, not the ones arriving at it', () => {
    const drawn = [cut('platform', 'bar'), cut('bar', 'arrival')]

    expect(scenesACutMayLandOn(scenes, drawn, 'arrival')).toEqual(new Set(['platform', 'bar']))
  })

  test('is empty in a Story of one Scene, which has nowhere to cut to', () => {
    expect(scenesACutMayLandOn([scene('arrival')], [], 'arrival')).toEqual(new Set())
  })
})
