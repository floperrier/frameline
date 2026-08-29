import { describe, expect, it } from 'vitest'
import { gatherLists } from '../../shared/utils/lists'

/**
 * The rows a join hands back, turned into shelves. One row a Story, and one row
 * carrying no Story where the List is empty — which is the case a `left join`
 * exists to answer and the one a plain group would drop.
 */
function row(id: string, title: string | null, story: string | null) {
  return { id, title, story: story === null ? null : { id: story } }
}

describe('gathering rows into Lists', () => {
  it('gathers the Stories of one List into it, in the order the rows came', () => {
    expect(gatherLists([
      row('a', 'To read', 'one'),
      row('a', 'To read', 'two'),
    ])).toEqual([{ id: 'a', title: 'To read', stories: [{ id: 'one' }, { id: 'two' }] }])
  })

  it('keeps a List nothing has been gathered into', () => {
    expect(gatherLists([row('a', 'To read', null)]))
      .toEqual([{ id: 'a', title: 'To read', stories: [] }])
  })

  it('puts Favourites first, whenever it was written', () => {
    const gathered = gatherLists([
      row('a', 'To read', 'one'),
      row('b', null, 'two'),
      row('c', 'Watched twice', null),
    ])

    expect(gathered.map(list => list.title)).toEqual([null, 'To read', 'Watched twice'])
    expect(gathered[0]!.stories).toEqual([{ id: 'two' }])
  })

  it('lets one Story sit in several Lists at once', () => {
    expect(gatherLists([
      row('a', null, 'one'),
      row('b', 'To read', 'one'),
    ]).map(list => list.stories)).toEqual([[{ id: 'one' }], [{ id: 'one' }]])
  })

  it('has nothing to gather where an Author has no List', () => {
    expect(gatherLists([])).toEqual([])
  })
})
