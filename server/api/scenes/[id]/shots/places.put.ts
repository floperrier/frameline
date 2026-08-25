/**
 * Renumbers the Shots of a Scene: the whole run in its new order, in one
 * request. A PUT for the same reason the Conditions and the Flags of a Scene are
 * written with one — what the endpoint takes is the list rather than a change to
 * it — and the two controls that move a Shot one Place send a list as well, so
 * there is a single way a Place is written.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const places = await readPlaces(event, 'Shot')

  return writePlaces(event, 'Shot', id, author.id, places)
})
