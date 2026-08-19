export default defineOAuthGoogleEventHandler({
  config: { scope: ['email', 'profile'] },
  onSuccess: (event, { user }) => signInAuthor(event, user),
  onError: event => sendRedirect(event, '/?error=google'),
})
