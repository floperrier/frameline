import type { H3Event } from 'h3'

/** The refusal each of the two numbered things is given, one message apiece. */
const MOVES = {
  Shot: 'refusals.moveDirection.shot',
  Cut: 'refusals.moveDirection.cut',
} as const

/**
 * Reads which way a Shot or a Cut is being moved, as the step to add to its
 * Place. One reader for both, because moving earlier or later is the same
 * request whichever of them is numbered.
 */
export async function readMoveStep(event: H3Event, what: 'Shot' | 'Cut') {
  const body = await readBody<{ direction?: unknown }>(event)

  if (body?.direction === 'earlier') return -1
  if (body?.direction === 'later') return 1

  throw createError({
    statusCode: 400,
    message: saying(event)(MOVES[what]),
  })
}
