/**
 * An Exit of a published Story taken by a Reading, counted for its Author under
 * the Exit the body names (`{ exit }`): see `countReading`. Always a 204, and no
 * session is needed or started.
 */
export default defineEventHandler(event => countReading(event, 'taken'))
