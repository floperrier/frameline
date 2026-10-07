<script setup lang="ts">
/**
 * Find and Replace — issue #447: a bar at the head of the writing that lights
 * every place a word is found in the Story, winds the document from one to the
 * next, and writes another word over one of them or over all of them. The places
 * are `placesIn` over the Story the page holds, so they follow every keystroke,
 * and the route that replaces them all counts the same ones. What counts as the
 * Story's words is
 * `docs/adr/0078-the-storys-words-are-found-where-a-reader-is-given-them.md`.
 *
 * A `<form role="search">` and not a dialog, because the Author goes on reading
 * and typing in the writing behind it: a modal bar would make the document it is
 * finding things in inert. Esc and *Close Find and Replace* put it away and the
 * focus back where it was when it opened.
 *
 * A Shot's words are lit with `CSS.highlights`, a range over the box's own text
 * nodes; a plain field is an `<input>`, whose text no range reaches, so the field
 * itself is lit, by `data-found`. Where the browser has no highlights the place
 * is still wound into view.
 */
const { story, write, change, settled, ask, announce } = defineProps<{
  /** The Story on the bench, which the places are found in and written over in place. */
  story: StoryInEditor
  /** The page's typed write, which a single Replace goes through as typing does. */
  write: Write
  /** The page's change, which *Replace All* goes through, so the Story is read back. */
  change: Change
  /** Once every typed write in flight has landed, which *Replace All* waits for. */
  settled: () => Promise<unknown>
  /** The page's confirmation, which *Replace All* asks before it writes. */
  ask: (question: string, verb: string) => Promise<boolean>
  /** What the bar has just done, said once in the page's status. */
  announce: (said: string) => void
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const find = ref('')
const replace = ref('')
const matchCase = ref(false)
/** Which place is current, as an index of `places`, held inside it by `here`. */
const current = ref(0)

const places = computed(() => find.value ? placesIn(story, find.value, matchCase.value) : [])
const here = computed<Place | undefined>(() => places.value[Math.min(current.value, places.value.length - 1)])

/** How many places, in how many Shots — nothing while nothing is sought. */
const count = computed(() => {
  if (!find.value) return ''
  if (!places.value.length) return t('find.notFound')
  const shots = new Set(places.value.filter(place => place.of === 'shot').map(place => place.id)).size
  return t('find.found', { places: places.value.length, shots }, shots)
})

const where = computed(() => here.value
  && t('find.at', { where: placeNamed(story, here.value, namesOnTheBench(story, t), t) }))

/** The ids `Writing.vue` gives each field, by the row and the key a place is in. */
const FIELD_IDS: Record<string, string> = {
  'shot formatted': 'shot',
  'shot description': 'description',
  'shot transcript': 'shot-transcript',
  'scene transcript': 'transcript',
  'scene question': 'question',
  'exit text': 'exit',
}

function fieldOf(place: Place) {
  return document.getElementById(`${FIELD_IDS[`${place.of} ${place.field}`]}-${place.id}`)
}

/**
 * A place in a Shot's words, as a range over the box's text nodes read end to
 * end — one per run, as `app/utils/draw.ts` and the editor both draw them. A
 * Redaction is no run, so the words it hides inside its bar are not counted.
 */
function rangeOf(box: HTMLElement, place: Place) {
  const words = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.parentElement?.closest('.bar') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  })
  const end = place.at + place.to - place.from
  const range = new Range()
  let seen = 0
  let started = false
  for (let node = words.nextNode(); node; node = words.nextNode()) {
    const length = node.textContent!.length
    if (!started && place.at < seen + length) {
      range.setStart(node, place.at - seen)
      started = true
    }
    if (started && end <= seen + length) {
      range.setEnd(node, end - seen)
      return range
    }
    seen += length
  }
}

/** The plain fields lit last time, which the next lighting puts out first. */
let lit: HTMLElement[] = []

function putOut() {
  for (const field of lit) delete field.dataset.found
  lit = []
}

function light() {
  putOut()
  const there: Range[] = []
  const now: Range[] = []
  for (const place of places.value) {
    const field = fieldOf(place)
    if (!field) continue
    if (place.field === 'formatted') {
      const range = rangeOf(field, place)
      if (range) (place === here.value ? now : there).push(range)
    }
    else if (place === here.value || field.dataset.found !== 'here') {
      field.dataset.found = place === here.value ? 'here' : 'there'
      lit.push(field)
    }
  }
  if (!('highlights' in CSS)) return
  CSS.highlights.set('found', new Highlight(...there))
  CSS.highlights.set('found-here', new Highlight(...now))
}

/** The current place brought into view, its fold opened if it stands in a shut one. */
function wind() {
  const place = here.value
  const field = place && fieldOf(place)
  if (!field) return
  const fold = field.closest('details')
  if (fold && !fold.open) fold.open = true
  // No `behavior`: the scroller's own `scroll-behavior`, and its answer to
  // reduced motion, decide — as `windOn` on the page leaves them to.
  const range = place.field === 'formatted' ? rangeOf(field, place) : undefined
  ;(range?.startContainer.parentElement ?? field).scrollIntoView({ block: 'center' })
}

/** Next and Previous wrap, as every find bar does. */
function step(by: 1 | -1) {
  const n = places.value.length
  if (!n) return
  current.value = (Math.min(current.value, n - 1) + by + n) % n
  wind()
}

/**
 * Where the caret goes once nothing is left to act on: back to *Find*, rather
 * than on a button that has just been disabled under it.
 */
function emptied() {
  if (!places.value.length) document.getElementById('finding-what')?.focus()
}

/**
 * The current place written over, in the Story the page holds and then by the
 * row's own PATCH as a typed write. A Shot's words are given a new object, which
 * is what the editor mounted on that Shot watches for. The current place moves to
 * the first one after the new words, so a replacement that still matches — a
 * change of case alone — is not found again under the caret.
 */
async function replaceHere() {
  const place = here.value
  if (replacing.value || !place) return
  const { value } = replacements(story, [place], replace.value)[0]!
  Object.assign(
    rowOf(story, place),
    { [place.field]: value },
    place.field === 'formatted' ? { text: textOf(value as Formatted) } : {},
  )
  write(() => send(`/api/${place.of}s/${place.id}`, { method: 'PATCH', body: { [place.field]: value } }))

  const after = places.value.findIndex(held => held.order > place.order
    || (held.order === place.order && held.at >= place.at + replace.value.length))
  current.value = Math.max(after, 0)
  await nextTick()
  wind()
  emptied()
}

/**
 * True from the Author's yes until the Story is read back. A *Replace* pressed
 * meanwhile would be worked out from the Story as it was and could land after
 * the request, putting the old words back, and a second *Replace All* would
 * write over words the first had already replaced, so both wait. They wait
 * rather than go disabled: the confirmation hands the focus back to *Replace
 * All* as it closes, and a control disabled under the focus drops it on the page.
 */
const replacing = ref(false)

/**
 * Every place written over in one request, once the typed writes in flight have
 * landed and the Author has said yes: the route counts the places the bar does,
 * and the page's change reads the Story back, refused or not.
 */
async function replaceAll() {
  if (replacing.value || !places.value.length) return
  await settled()
  const n = places.value.length
  const looking = { find: find.value, replace: replace.value, matchCase: matchCase.value }
  if (!await ask(t('find.confirm', { find: looking.find, replace: looking.replace }, n), t('find.replaceAll'))) return

  replacing.value = true
  try {
    let replaced = 0
    if (await change(async () => {
      ({ replaced } = await send(`/api/stories/${story.id}/replace`, { method: 'POST', body: looking }) as { replaced: number })
    })) announce(t('find.replaced', replaced))
  }
  finally {
    replacing.value = false
  }
  await nextTick()
  emptied()
}

/** Where the focus was when the bar opened, which it is given back to. */
let gave: HTMLElement | null = null

function close() {
  emit('close')
  if (gave?.isConnected) gave.focus()
}

watch([find, matchCase], () => {
  current.value = 0
  nextTick(wind)
})
// ponytail: relit when the places or the current one change, not when the DOM
// alone does — a Shot's box swapped for its editor drops its ranges until the next
// keystroke. A MutationObserver on the writing, if that matters.
watch([places, here], light, { flush: 'post' })

onMounted(() => {
  gave = document.activeElement as HTMLElement | null
  document.getElementById('finding-what')?.focus()
  light()
})

onBeforeUnmount(() => {
  putOut()
  if (!('highlights' in CSS)) return
  CSS.highlights.delete('found')
  CSS.highlights.delete('found-here')
})
</script>

<template>
  <form
    role="search"
    class="finding"
    :aria-label="$t('find.findAndReplace')"
    @submit.prevent="step(1)"
    @keydown.esc.prevent="close"
  >
    <p class="field">
      <label class="eyebrow" for="finding-what">{{ $t('find.find') }}</label>
      <input
        id="finding-what"
        v-model="find"
        type="text"
        autocomplete="off"
        :maxlength="FIND_MAX_LENGTH"
      >
    </p>
    <p class="field">
      <label class="eyebrow" for="finding-with">{{ $t('find.replaceWith') }}</label>
      <input
        id="finding-with"
        v-model="replace"
        type="text"
        autocomplete="off"
        :maxlength="FIND_MAX_LENGTH"
      >
    </p>
    <label class="casing">
      <input v-model="matchCase" type="checkbox">
      {{ $t('find.matchCase') }}
    </label>

    <!-- An implicit polite live region: how many places, and which is current. -->
    <output class="count">
      <span class="tally">{{ count }}</span>
      <span v-if="where">{{ where }}</span>
    </output>

    <!-- *Next Place* submits, so `Enter` in either field is *Next Place*. -->
    <button type="button" :disabled="!places.length" @click="step(-1)">{{ $t('find.previous') }}</button>
    <button type="submit" :disabled="!places.length">{{ $t('find.next') }}</button>
    <button type="button" :disabled="!places.length" @click="replaceHere">{{ $t('find.replace') }}</button>
    <button type="button" :disabled="!places.length" @click="replaceAll">{{ $t('find.replaceAll') }}</button>
    <button type="button" @click="close">{{ $t('find.close') }}</button>
  </form>
</template>

<style scoped>
/* A plate laid over the head of the writing: one wrapping row of fields, the
   count and the acts, with the document going on under it. */
.finding {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--s2) var(--s3);
  margin: var(--s4) var(--s4) 0;
  padding: var(--s3);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
}

/* A label over its box, as the Question's fields are read. */
.field {
  display: flex;
  flex: 1 1 12rem;
  flex-direction: column;
  gap: var(--s1);
  margin: 0;
}

.casing {
  display: flex;
  align-items: center;
  gap: var(--s2);
  padding-block: var(--s2);
  font-size: 0.8125rem;
}

.casing input {
  inline-size: auto;
  accent-color: var(--grease);
}

/* The bar counting, in the machine's own data face, and under it where the
   current place is. */
.count {
  display: grid;
  flex: 1 1 12rem;
  gap: var(--s1);
  color: var(--muted);
  font-size: 0.8125rem;
}

.tally {
  font-family: var(--data);
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
}

/* The lighting is drawn on the writing, outside this component. A place is
   the Author's own words, so it is lit in the grease pencil. */
:global(::highlight(found)) {
  background-color: color-mix(in oklab, var(--grease) 35%, transparent);
}

:global(::highlight(found-here)) {
  background-color: var(--grease);
  color: var(--ink);
}

:global([data-found]) {
  outline: 1px solid color-mix(in oklab, var(--grease) 60%, transparent);
  outline-offset: 1px;
}

:global([data-found='here']) {
  outline: 2px solid var(--grease);
}
</style>
