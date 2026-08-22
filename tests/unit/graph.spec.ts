import { describe, expect, test } from 'vitest'
import { cutLine, NODE_WIDTH } from '../../shared/utils/scenes'

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
