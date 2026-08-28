/**
 * The longest Comment an Author may write. Shared so the server's rejection and
 * the form's own limit cannot drift apart, the way a Story's title and an
 * Author's Name are.
 *
 * Long enough to say something about a Story and short enough that nobody
 * publishes a second Story inside a Comment on the first: what is written here
 * answers a work, it is not one.
 */
export const COMMENT_MAX_LENGTH = 2000
