/**
 * A question asked before an act that takes something with it, and the answer
 * the act waits on. In the shape of the other composables on these pages —
 * `useToast` for a message that clears itself, `useEditing` for `problem`,
 * `change` and `write` — so a delete handler reads as asking and returning
 * early:
 *
 *     if (!await ask(t('editor.confirmDeleteScene', named), t('editor.deleteScene'))) return
 *     return change(...)
 *
 * Which acts ask at all is a rule rather than a habit, and
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md` records it: a Récit
 * and a Scène ask, a Plan, a Coupe and an unpublish do not.
 *
 * The state is here and the surface is `Confirmation.vue`, because what the
 * page needs is a promise it can wait on and what the page draws is a
 * `<dialog>`. Only one question is ever in flight: the surface is modal, so
 * nothing can be clicked to start a second one.
 */
/** The question on screen, and the verb on the button that performs the act. */
export type Asked = { question: string, verb: string }

export function useConfirming() {
  const asked = ref<Asked>()
  let settle: ((confirmed: boolean) => void) | undefined

  function ask(question: string, verb: string) {
    asked.value = { question, verb }
    return new Promise<boolean>((resolve) => { settle = resolve })
  }

  /**
   * What the surface came back with. Taken off the screen before the act runs,
   * so the Author is not left reading the question while the Story is being
   * changed underneath it.
   */
  function answer(confirmed: boolean) {
    asked.value = undefined
    settle?.(confirmed)
    settle = undefined
  }

  return { asked, ask, answer }
}
