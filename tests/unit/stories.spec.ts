import { describe, expect, it } from 'vitest'
import { coverOf } from '../../shared/utils/stories'

const shot = (id: string, image: string | null) => ({ id, image })

const story = {
  coverShotId: null as string | null,
  openingSceneId: 'opening' as string | null,
  scenes: [
    { id: 'before', shots: [shot('b1', '/api/shots/b1/image')] },
    { id: 'opening', shots: [shot('o1', null), shot('o2', '/api/shots/o2/image'), shot('o3', '/api/shots/o3/image')] },
  ],
}

describe('the Image a Story is presented by', () => {
  it('is the Cover the Author named', () => {
    expect(coverOf({ ...story, coverShotId: 'b1' })).toBe('b1')
  })

  it('is the first Image of the Opening Scene where none is named', () => {
    expect(coverOf(story)).toBe('o2')
  })

  it('falls back when the named Shot has lost its Image or is gone', () => {
    expect(coverOf({ ...story, coverShotId: 'o1' })).toBe('o2')
    expect(coverOf({ ...story, coverShotId: 'gone' })).toBe('o2')
  })

  it('is nothing where no Opening Scene is marked, or it carries no Image', () => {
    expect(coverOf({ ...story, openingSceneId: null })).toBeNull()
    expect(coverOf({ ...story, openingSceneId: 'nowhere' })).toBeNull()
    expect(coverOf({ ...story, scenes: [{ id: 'opening', shots: [shot('o1', null)] }] })).toBeNull()
  })
})
