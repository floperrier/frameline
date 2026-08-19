export default defineOAuthGoogleEventHandler({
  config: { scope: ['email', 'profile'] },
  onSuccess: (event, { user }) => signInAuthor(event, 'google', user),
  onError: (event, error) => failSignIn(event, 'google', error),
})
