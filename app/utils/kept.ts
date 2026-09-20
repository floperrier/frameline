/**
 * What one browser keeps of a Reading, and what it keeps beside it.
 *
 * The Path is per Story and is a reading of the Story: the Exits taken, the Shots
 * behind, the seed. Whether sound is on and whether the Transcript is shown are
 * properties of the person, so they are kept once for the browser rather than per
 * Story — two lifetimes, and neither of them inside the Path. See
 * `docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md` and
 * `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md`.
 *
 * Every read and every write is wrapped: a browser that refuses storage, or has
 * none left, refuses quietly — the Reading goes on, it is just not kept.
 */
import { resumes, type Path, type StoryToRead } from '#shared/utils/reading'

export function readingKey(storyId: string) {
  return `reading-${storyId}`
}

export const SOUND_OFF = 'frameline.sound-off'
export const TRANSCRIPT_SHOWN = 'frameline.transcript-shown'

/**
 * The Path this browser kept from an earlier visit, if it is one to go back to:
 * `resumes` says whether it has moved, has not ended, and still fits the Story as
 * published. Anything else in the slot — nothing, an ending, a Path the Author has
 * since edited from under, bytes that are not a Path — is a fresh start.
 *
 * Here rather than inside the Reading, because the title card has to say *Resume*
 * rather than *Begin* before the Reading is on the page at all, and two readings
 * of what is kept would be two products.
 */
export function keptReading(storyId: string, story: StoryToRead): Path | undefined {
  let at: unknown
  try {
    at = JSON.parse(localStorage.getItem(readingKey(storyId)) ?? 'null')
  }
  catch {
    return
  }

  return isPath(at) && resumes(story, at) ? at : undefined
}

/** Whether what the browser handed back has the shape of a Path, whatever wrote it. */
export function isPath(at: unknown): at is Path {
  return typeof at === 'object' && at !== null
    && Number.isInteger((at as Path).seed)
    && Number.isInteger((at as Path).shot) && (at as Path).shot >= 0
    && Array.isArray((at as Path).taken)
}

/** One kept answer to a yes-or-no question about the person rather than the Story. */
export function keptFlag(key: string) {
  try {
    return localStorage.getItem(key) === '1'
  }
  catch {
    return false
  }
}

export function keepFlag(key: string, held: boolean) {
  try {
    localStorage.setItem(key, held ? '1' : '0')
  }
  catch {}
}
