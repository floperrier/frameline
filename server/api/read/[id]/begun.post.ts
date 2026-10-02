/**
 * A Reading of a published Story begun at its opening, counted for its Author:
 * see `countReading`. Always a 204, and no session is needed or started.
 */
export default defineEventHandler(event => countReading(event, 'begun'))
