/**
 * A message that appears on screen and clears itself, for a success that
 * needs no confirming click — a Scene created, say. `problem` in
 * `useEditing` stays until the next attempt because a refusal is worth
 * reading at leisure; this is the opposite kind of message, so it leaves on
 * its own.
 */
export function useToast(duration = 3000) {
  const message = ref('')
  let timeout: ReturnType<typeof setTimeout>

  function show(text: string) {
    message.value = text
    clearTimeout(timeout)
    timeout = setTimeout(() => { message.value = '' }, duration)
  }

  return { message, show }
}
