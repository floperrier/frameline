/**
 * Who may lay a response of ours inside a page of theirs. The embed may be
 * framed by anybody: the Story is public at its link already, and the frame
 * shows nothing that link does not. Everything else may be framed by Frameline
 * alone, so no other site can lay the bench under a decoy and have it pressed.
 * See `docs/adr/0068-a-story-plays-inside-another-page.md`.
 *
 * Here rather than in `routeRules`, because the rules that match a path are
 * merged and a more particular one cannot take a header away: the embed would
 * carry the `X-Frame-Options` written for everything else. On Vercel the same
 * rules are also copied into the platform's routes, where two of them would set
 * the one header and which one won would be the platform's to decide.
 *
 * A not-found is drawn by Nuxt through a request of its own to `/__nuxt_error`,
 * whose headers replace the ones the page was answered with, so the embed of a
 * Story unpublished since is refused its frame rather than saying *No such
 * Story.* inside it. Gone either way, which is all a link to a Story that is gone
 * may say.
 */
export default defineEventHandler((event) => {
  if (event.path.startsWith('/embed/')) {
    setResponseHeader(event, 'content-security-policy', 'frame-ancestors *')
  }
  else {
    setResponseHeaders(event, {
      'content-security-policy': 'frame-ancestors \'self\'',
      'x-frame-options': 'SAMEORIGIN',
    })
  }
})
