import { and, eq, inArray } from 'drizzle-orm'
import { shots } from '../../db/schema'
import { useDb } from '../../db'

/**
 * Writes what an Author says about one Shot: its text, the Description of the
 * image it carries, the Transcript of the Sound it strikes with, its own Cut,
 * its four Effects and how its text arrives. Each comes through one door because
 * each is one Shot's row, and each lands on its own: a body naming one of them
 * leaves the rest
 * where they were.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')
  const changes = await readShotChanges(event)

  const [shot] = await useDb()
    .update(shots)
    .set(changes)
    .where(and(eq(shots.id, id), inArray(shots.sceneId, scenesOf(author.id))))
    .returning({
      id: shots.id,
      text: shots.text,
      position: shots.position,
      description: shots.description,
      transcript: shots.transcript,
      cutAfter: shots.cutAfter,
      cutOver: shots.cutOver,
      cutThrough: shots.cutThrough,
      layout: shots.layout,
      cropX: shots.cropX,
      cropY: shots.cropY,
      imageArrives: shots.imageArrives,
      imageLasts: shots.imageLasts,
      textArrives: shots.textArrives,
      textLasts: shots.textLasts,
      textAfter: shots.textAfter,
      textBy: shots.textBy,
      textPace: shots.textPace,
      textOver: shots.textOver,
      textStays: shots.textStays,
    })

  if (!shot) throw notFound(event, 'Shot')
  return shot
})
