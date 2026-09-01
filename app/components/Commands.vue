<script setup lang="ts">
/**
 * The bar every act of the bench is reached by naming it in. It holds no list
 * of acts: it reads the controls the bench is drawing right now — the ones
 * their own templates mark with `data-command` — and pressing a result presses
 * that control. `app/utils/commands.ts` says why, and
 * `docs/adr/0035-every-act-of-the-bench-is-reachable-by-naming-it.md` records
 * the decision.
 *
 * A `<dialog>` opened modally, like the one the product asks a question in, so
 * the browser does the parts a hand-built overlay gets wrong: the bench behind
 * it goes inert, `Escape` dismisses it, focus moves in when it opens and back
 * to the control that opened it when it closes.
 *
 * Nothing here is a combobox. The results are buttons and the keyboard moves
 * real focus between them, so what reads the page announces each one as it is
 * arrived at without a line of ARIA saying so — and a press with the pointer is
 * the same press.
 */
const opened = defineModel<boolean>({ required: true })

const bar = useTemplateRef<HTMLDialogElement>('bar')
const field = useTemplateRef<HTMLInputElement>('field')
const results = useTemplateRef<HTMLElement>('results')

/** What the Author has typed, which is the whole of the state the bar carries. */
const typed = ref('')

/**
 * The Commands the bench was offering when the bar opened. Read once rather
 * than watched: the bar is modal, so nothing can add or take away a control
 * while it is up, and a live read would be a `MutationObserver` earning nothing.
 */
const offered = ref<Command[]>([])

const reached = computed(() => commandsReached(offered.value, typed.value))

// After the update rather than before it, so the dialog the browser is about to
// move focus into is in the document by the time it looks for it.
watch(opened, (open) => {
  if (!open) return bar.value?.open && bar.value.close()

  typed.value = ''
  const controls = document
    .querySelectorAll<HTMLElement>('[data-command]:not(:disabled)')
  offered.value = [...controls]
    .map(element => ({ name: element.dataset.command!, press: () => element.click() }))
  bar.value?.showModal()
}, { flush: 'post' })

/**
 * Runs a Command: the bar goes, and the control it stood for is pressed. In that
 * order, because closing hands focus back to whatever opened the bar and the act
 * that follows usually puts focus somewhere of its own — a Scene opened for
 * writing puts it in the Scene's name, and it has to be the one that wins.
 */
function run(command?: Command) {
  if (!command) return

  bar.value?.close()
  command.press()
}

/**
 * The keyboard down the results. `↓` from the field arrives at the first, `↑`
 * from the first goes back to the field, and neither wraps: a list that comes
 * round to the top under one more press is one an Author cannot tell the end of.
 */
function walk(event: KeyboardEvent, at: number) {
  const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
  if (!step) return

  event.preventDefault()
  if (at + step < 0) return field.value?.focus()

  results.value?.querySelectorAll('button')[at + step]?.focus()
}

/**
 * The key the bar is opened and closed with, taken off the browser's own — what
 * `⌘K` would otherwise do is put the caret in the address bar's search, and on
 * this page the thing to reach by typing is the bench.
 *
 * Read off where the key sits as well as off the character it carries, the way
 * the scale's shortcuts are: `event.code` is the same on every layout. It is a
 * toggle rather than an opening, because the hand that reached for it is the
 * hand that changed its mind.
 */
function toggleOnKeys(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return
  if (event.key.toLowerCase() !== 'k' && event.code !== 'KeyK') return

  event.preventDefault()
  opened.value = !opened.value
}

onMounted(() => document.addEventListener('keydown', toggleOnKeys))
onBeforeUnmount(() => document.removeEventListener('keydown', toggleOnKeys))
</script>

<template>
  <!-- Let go of by a press outside it, which is the gesture an overlay is
       dismissed by everywhere. `.self` is what tells the backdrop from the bar:
       the padding is on the panel inside, so a press that lands on the dialog
       itself landed on nothing. -->
  <dialog
    ref="bar"
    class="commands"
    aria-labelledby="commands-heading"
    @click.self="opened = false"
    @close="opened = false"
  >
    <!-- A form, so `Enter` runs the first result without a key being listened
         for: submitting is what a field in a form does. -->
    <form class="instrument" @submit.prevent="run(reached[0])">
      <label id="commands-heading" class="eyebrow" for="commands-typed">
        {{ $t('commands.heading') }}
      </label>
      <input
        id="commands-typed"
        ref="field"
        v-model="typed"
        autofocus
        autocomplete="off"
        @keydown.down.prevent="results?.querySelector('button')?.focus()"
      >

      <!-- Every Command the typed name reaches, in the order the bench draws
           them. No count and no headings above them: the list is the answer, and
           an Author who typed three letters is reading it rather than being told
           about it. -->
      <ul v-if="reached.length" ref="results">
        <!-- Keyed by where it comes in the list rather than by its name: two
             Scenes may share one, and nothing here can tell them apart. -->
        <li v-for="(command, at) in reached" :key="at">
          <button type="button" @click="run(command)" @keydown="walk($event, at)">
            {{ command.name }}
          </button>
        </li>
      </ul>
      <p v-else class="none">{{ $t('commands.nothing') }}</p>
    </form>
  </dialog>
</template>

<style scoped>
/* The row of controls above the bench, lifted into the top layer: the same
   steel, the same machined edge, the same shadow a card carries. Not centred in
   the window but held near its top, where an instrument reached for is, and
   leaving the bench visible under it — what is being named is down there. */
.commands {
  max-inline-size: min(100%, 32rem);
  margin: 12dvh auto auto;
  padding: 0;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
  color: var(--paper);
  box-shadow: var(--lifted);
}

.commands::backdrop {
  background: color-mix(in oklab, var(--room) 72%, transparent);
}

.instrument {
  display: grid;
  gap: var(--s2);
  padding: var(--s4);
}

/* As far as the window allows and no further, so a Story of forty Scenes
   scrolls inside the bar rather than pushing its own field off the screen. */
ul {
  max-block-size: 46dvh;
  margin: var(--s2) 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  overscroll-behavior: contain;
}

/* Each result across the whole width and read from its leading edge: a list of
   names is read down a straight line, and a button centred in its own row would
   put every name in a different place. */
li button {
  inline-size: 100%;
  border-color: transparent;
  background: none;
  text-align: start;
}

li button:hover,
li button:focus-visible {
  border-color: color-mix(in oklab, var(--light) 55%, var(--edge));
  background: var(--steel-lit);
}

.none {
  margin: var(--s2) 0 0;
  color: var(--muted);
}
</style>
