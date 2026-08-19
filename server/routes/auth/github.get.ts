export default defineOAuthGitHubEventHandler({
  config: { scope: ['user:email'], emailRequired: true },
  onSuccess: (event, { user }) => signInAuthor(event, user),
  onError: event => sendRedirect(event, '/?error=github'),
})
