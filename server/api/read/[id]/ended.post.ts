/**
 * A Reading of a published Story ended, counted for its Author under the Scene
 * the body names (`{ scene }`): see `countReading`. Always a 204, and no session
 * is needed or started.
 */
export default defineEventHandler(event => countReading(event, 'ended'))
