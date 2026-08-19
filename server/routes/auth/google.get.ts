export default defineOAuthGoogleEventHandler({
  config: { scope: ['email', 'profile'] },
  async onSuccess(event, { user }) {
    if (!user.email) {
      return sendRedirect(event, '/?error=no-email')
    }
    const author = await resolveAuthor(user.email, user.name)
    await setUserSession(event, {
      user: { id: author.id, email: author.email, name: author.name },
    })
    return sendRedirect(event, '/stories')
  },
  onError(event) {
    return sendRedirect(event, '/?error=google')
  },
})
