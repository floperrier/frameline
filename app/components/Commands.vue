<script setup lang="ts">
/**
 * The bar every act of the bench is reached by naming it in. It holds almost no
 * list of acts: it reads the controls the bench is drawing right now — the ones
 * their own templates mark with `data-command` — and pressing a result presses
 * that control. The one exception is the offer to write a Scene under a name
 * nothing answered to, which has no control behind it because a Scene is
 * otherwise born from an Exit; `showing` says why it is here and what bounds it.
 * `app/utils/commands.ts` says the rest, and
 * `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md` records
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

/**
 * The one thing the bar asks the page for rather than pressing on the bench: a
 * Scene written under the name that reached nothing. The page owns it because
 * the page owns `change` and which Scene is on the writing surface, the way it
 * owns every other act that alters the Story.
 */
const emit = defineEmits<{ make: [name: string] }>()

const { t } = useI18n()

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

/**
 * What the list actually shows: the Commands the typed name reached, or — where
 * it reached none — the offer to write a Scene under it.
 *
 * This is the one entry that has no control behind it, and the only place the
 * bar writes an act rather than finding one. It stands here, in the shape of a
 * Command, so that `Enter`, `↓` and a press with the pointer all reach it by the
 * machinery every other entry already goes through: a second kind of row would
 * be a second keyboard to get right. See
 * `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`, which
 * records the exception and its boundary.
 *
 * Offered only where nothing answers. A Story of forty Scenes would otherwise
 * offer to write *Le* under an Author halfway through typing *Le café*, and a
 * making that stands under every partial name is a making somebody presses by
 * mistake.
 */
const showing = computed<Command[]>(() => {
  if (reached.value.length) return reached.value

  const name = typed.value.trim()
  if (!name) return []

  return [{ name: t('commands.writeScene', { name }), press: () => emit('make', name) }]
})

// After the update rather than before it, so the dialog the browser is about to
// move focus into is in the document by the time it looks for it.
watch(opened, (open) => {
  if (!open) return bar.value?.open && bar.value.close()

  typed.value = ''
  const controls = document
    .querySelectorAll<HTMLElement>('[data-command]:not(:disabled)')
  offered.value = [...controls]
    // The controls the bench is drawing *right now*, which is not the same set as
    // the controls marked with a name: a fold takes a column of the bench away by
    // hiding it, and the acts inside it go with it. Asked of the browser rather
    // than worked out from a width, so the bar and the bench cannot disagree —
    // and the visually hidden controls, which are on screen for a hand on the
    // keyboard, are still counted as drawn.
    .filter(element => element.checkVisibility())
    .map(element => ({ name: element.dataset.command!, press: () => press(element) }))
  bar.value?.showModal()
}, { flush: 'post' })

/**
 * Presses a control — or, where the control is a `<select>`, which no script
 * can press, puts the hand on it: focus lands, and the browser is asked to open
 * the list, which it does because the ask arrives inside the very gesture that
 * ran the Command. A browser without `showPicker()` for a select is left with
 * focus alone, and one press of Space or the first letter of a Scene's name opens
 * it from there. `showPicker()` throws rather than declines when it cannot
 * open, so the refusal is swallowed: focus is already where it should be.
 */
function press(element: HTMLElement) {
  if (!(element instanceof HTMLSelectElement)) return element.click()
  element.focus()
  try {
    element.showPicker?.()
  }
  catch {}
}

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
 * The bar reporting that it has shut, which is not the same fact as the moment
 * it was asked to. A `<dialog>` fires `close` from a queued task rather than
 * from inside `close()` itself, so a bar put away and asked for again inside the
 * same breath — two presses of the key, which is one hand changing its mind —
 * receives the first `close` after the second `showModal`. Taken at face value
 * that report says the bar is gone while it is on the screen, and the watch
 * above then makes it true by shutting the bar the Author has just opened.
 *
 * So the report is believed only where the bar agrees with it.
 */
function letGoIfShut() {
  if (!bar.value?.open) opened.value = false
}

/**
 * Escape, taken as it happens rather than as it is reported. The browser fires
 * `cancel` inside the very press that dismisses the bar and only queues `close`
 * after it, so between the two the state here still says the bar is up while the
 * screen says it is gone — and the key pressed in that window toggles the bar
 * shut a second time instead of opening it, which is a bar that ignores the hand
 * reaching for it. Written from the event that arrives first, so there is no
 * window at all.
 */
function letGoOnEscape() {
  opened.value = false
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
    @cancel="letGoOnEscape"
    @close="letGoIfShut"
  >
    <!-- A form, so `Enter` runs the first result without a key being listened
         for: submitting is what a field in a form does. -->
    <form class="instrument" @submit.prevent="run(showing[0])">
      <label id="commands-heading" class="eyebrow" for="commands-typed">
        {{ $t('commands.heading') }}
      </label>
      <input
        id="commands-typed"
        ref="field"
        v-model="typed"
        autofocus
        autocomplete="off"
        :maxlength="SCENE_NAME_MAX_LENGTH"
        @keydown.down.prevent="results?.querySelector('button')?.focus()"
      >

      <!-- Every Command the typed name reaches, in the order the bench draws
           them. No count and no headings above them: the list is the answer, and
           an Author who typed three letters is reading it rather than being told
           about it. -->
      <!-- Said above the offer rather than instead of it: an Author who typed a
           name nothing answers to is told so, and handed the one thing left to
           do with that name. -->
      <p v-if="!reached.length && typed.trim()" class="none">
        {{ $t('commands.nothing') }}
      </p>
      <ul v-if="showing.length" ref="results">
        <!-- Keyed by where it comes in the list rather than by its name: two
             Scenes may share one, and nothing here can tell them apart. -->
        <li v-for="(command, at) in showing" :key="at">
          <button type="button" @click="run(command)" @keydown="walk($event, at)">
            {{ command.name }}
          </button>
        </li>
      </ul>
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
