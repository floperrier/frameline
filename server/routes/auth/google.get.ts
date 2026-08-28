export default defineOAuthGoogleEventHandler({
  config: { scope: ['email', 'profile'] },
  onSuccess: (event, { user }) => signInAuthor(event, 'google', {
    ...user,
    // Google calls it `picture`; GitHub calls it `avatar_url`. See the GitHub
    // handler beside this one.
    avatar: user.picture,
  }),
  onError: (event, error) => failSignIn(event, 'google', error),
})
