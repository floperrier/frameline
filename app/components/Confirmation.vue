<script setup lang="ts">
/**
 * The one place the product asks before doing something. A `<dialog>` opened
 * modally, so the browser does the parts a hand-built panel gets wrong: the
 * page behind it is inert, `Escape` dismisses it, focus moves into it when it
 * opens and back to the control that opened it when it closes.
 *
 * The question and the verb come from the page, because only the page knows
 * what is about to go — `useConfirming` holds them and the promise the handler
 * waits on. Nothing here is a `confirm()`: the phrase is set in the bench's own
 * type, and the destructive verb sits on the button that performs the act
 * rather than on an OK that could be anything.
 */
const { asked } = defineProps<{
  /** What is being asked, while it is being asked and not after. */
  asked?: Asked
}>()

/** Answered either way, so the handler waiting on it is never left waiting. */
const emit = defineEmits<{ answer: [confirmed: boolean] }>()

const asking = useTemplateRef<HTMLDialogElement>('asking')

// After the update rather than before it, so the buttons the browser is about
// to move focus into are in the document by the time it looks for them.
watch(() => asked, (question) => {
  if (question) asking.value?.showModal()
  else if (asking.value?.open) asking.value.close()
}, { flush: 'post' })

/**
 * Every way out arrives here, which is what keeps the safe answer the default:
 * the dialog closes with a return value only when the destructive button was
 * the thing pressed, and `Escape`, the dismissing button and anything else the
 * browser closes it with all leave it empty.
 */
function closed() {
  emit('answer', asking.value?.returnValue === 'confirmed')
}
</script>

<template>
  <dialog ref="asking" class="asking" @close="closed">
    <!-- Rendered only while it is being asked, so nothing reads back the last
         question after it has been answered. -->
    <form v-if="asked" method="dialog">
      <p class="eyebrow">{{ $t('confirmation.heading') }}</p>
      <p class="named">{{ asked.question }}</p>

      <div class="answers">
        <!-- First, and focused: what a stray `Enter` lands on is the answer that
             destroys nothing. `method="dialog"` closes with no return value,
             which is how `closed` reads it as a refusal. -->
        <button autofocus type="submit">{{ $t('confirmation.dismiss') }}</button>
        <button type="button" class="danger" @click="asking?.close('confirmed')">
          {{ asked.verb }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
/* Lifted off the bench in the bench's own materials — steel, a machined edge,
   the same shadow a node carries — rather than the grey box an operating system
   would have drawn. */
.asking {
  max-inline-size: min(100%, 34rem);
  margin: auto;
  padding: var(--s4);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
  color: var(--paper);
  box-shadow: var(--lifted);
}

.asking::backdrop {
  background: color-mix(in oklab, var(--room) 72%, transparent);
}

form {
  display: grid;
  gap: var(--s3);
}

/* The Author's own words — a title, a name and its counts — so they are set in
   the face the interface reads in and given room to wrap. */
.named {
  max-inline-size: 44ch;
  text-wrap: pretty;
}

.answers {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: var(--s2);
}
</style>
