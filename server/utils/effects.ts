import type { H3Event } from 'h3'
import { isArrival, isLasting } from '../../shared/utils/scenes'
import type { EffectCarrier } from '../../shared/utils/scenes'

/**
 * Reads one Effect off the body: a whole one its carrier is offered, or null,
 * which is none. Its carrier is the field's own first word, so the Image's and the
 * text's are held to what each is offered and a caller cannot name one and read
 * the other. What is neither is refused, and the refusal travels in the body:
 * `docs/adr/0009-a-refusal-travels-in-the-body.md`.
 */
async function readEffect<T>(
  event: H3Event, field: string, holds: (held: unknown, carrier: EffectCarrier) => held is T,
  refusal: string,
) {
  const body = await readBody<Record<string, unknown>>(event)
  const held = body?.[field]

  if (held === null) return null
  if (!holds(held, field.startsWith('image') ? 'image' : 'text')) {
    throw createError({ statusCode: 400, message: saying(event)(refusal) })
  }

  return held
}

/** What the Image or the text plays as the beat arrives. */
export function readArrival(event: H3Event, field: 'imageArrives' | 'textArrives') {
  return readEffect(event, field, isArrival, 'refusals.effectArrives')
}

/** What the Image or the text plays while the beat stands. */
export function readLasting(event: H3Event, field: 'imageLasts' | 'textLasts') {
  return readEffect(event, field, isLasting, 'refusals.effectLasts')
}
