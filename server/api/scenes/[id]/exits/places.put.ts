/**
 * Renumbers the ways on leaving a Scene: every Exit it offers, in the order the
 * Reader is to meet them. The Shots of a Scene are renumbered by the same
 * statement — an Exit is numbered within the Scene it leaves, which is the Scene
 * this id names.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const places = await readPlaces(event, 'Exit')

  return writePlaces(event, 'Exit', id, author.id, places)
})
