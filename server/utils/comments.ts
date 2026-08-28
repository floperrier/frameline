import type { H3Event } from 'h3'

/**
 * Reads a Comment's text from the request body. A trust boundary like a Story's
 * title: what is written here is read by everybody who opens the Story's public
 * link, so its length is capped here rather than left to Postgres.
 *
 * Blank is a refusal rather than an empty Comment. A Comment is the whole of
 * what an Author said, so one saying nothing is a signature with nothing under
 * it — and deleting is how a Comment is taken back, not emptying it.
 */
export async function readCommentText(event: H3Event) {
  const body = await readBody<{ text?: unknown }>(event)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''

  if (!text) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.commentText') })
  }
  if (text.length > COMMENT_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.commentTextLong', { max: COMMENT_MAX_LENGTH }),
    })
  }

  return text
}
