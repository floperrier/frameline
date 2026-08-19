export default defineOAuthGitHubEventHandler({
  config: { scope: ['user:email'], emailRequired: true },
  onSuccess: (event, { user }) => signInAuthor(event, 'github', user),
  onError: (event, error) => failSignIn(event, 'github', error),
})
