export default defineOAuthGitHubEventHandler({
  config: { scope: ['user:email'], emailRequired: true },
  onSuccess: (event, { user }) => signInAuthor(event, 'github', {
    ...user,
    // The picture GitHub serves for the account, under the name each provider
    // gives it. Nothing else about the identity is renamed: the two providers
    // agree on `email` and on `name`, and disagree only here.
    avatar: user.avatar_url,
  }),
  onError: (event, error) => failSignIn(event, 'github', error),
})
