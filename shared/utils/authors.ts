/**
 * The longest Name an Author may carry. Shared so the server's rejection and the
 * form's own limit cannot drift apart, the way a Story's title is. Short on
 * purpose: a Name is read beside a title in a list, and one long enough to push
 * the title off the line is a Name being used as a sentence.
 */
export const AUTHOR_NAME_MAX_LENGTH = 60
