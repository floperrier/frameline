export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  // Sent to the door in the language they were reading: `/` in English and
  // `/fr` in French, which is what `localePath` resolves the same address to.
  if (!loggedIn.value) return navigateTo(useLocalePath()('/'))
})
