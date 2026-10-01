<script setup lang="ts">
/**
 * The one editor on the bench, mounted on the Shot the caret is in, and the
 * toolbar over it — issue #359. Every other Shot is the renderer's drawing in a
 * box; this is the same drawing made editable, its schema and its drawing taken
 * from `app/utils/formatting.ts` and `app/utils/draw.ts`.
 *
 * It is made in its own element as soon as that is drawn, and focused there and
 * then, where the press landed or at the end of the text: Tiptap's Vue component
 * would move the editor in a tick later and focus it a frame after that, and a
 * key struck in between would land on nothing.
 *
 * It writes nothing itself. It says the plain words on every change, which the
 * bench counts and reads, with the text as it stands, which the Preview draws;
 * and it hands over the formatted text to be written — read through the
 * boundary first, so what is sent is the shape the server reads — when the caret
 * leaves it, and before the bench is asked about `Enter`. A shape the boundary
 * would refuse is handed over all the same rather than kept back without a word:
 * the server refuses it in a sentence the bench shows, and the Story read back
 * puts the text it holds in its place —
 * `docs/adr/0008-refetch-is-for-a-refusal.md`.
 *
 * The keys of the run of beats stay the bench's
 * (`docs/adr/0033-a-scene-is-written-as-one-document.md`): `Enter`, `Backspace`
 * and `Alt` with an arrow are put to it first through `keys`, and `Ctrl` or `Cmd`
 * with an arrow is not bound here, so the Scene's own section hears it. `Tab`
 * reaches the toolbar because the toolbar is the next thing in the document.
 *
 * The toolbar also says an Effect of the words — issue #361. *Add an Effect* opens
 * a row under its buttons holding the two sentences a Shot's row says of its
 * whole text, said here of the words selected or of the run the caret is in, and
 * *Take the Effect Off* takes both off that run.
 *
 * No Command is marked on the toolbar, those two among them: each act is one key
 * or one press on a selection in view, which is the exemption `docs/adr/0035-
 * every-act-marked-on-the-bench-is-reachable-by-naming-it.md` gives a row's
 * marks, and a select is exempt anyway.
 */
import { Editor, getMarkAttributes, getNodeAttributes, isMarkActive } from '@tiptap/core'
import { NodeSelection, Selection } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { LineKind } from '~/utils/formatting'

const props = defineProps<{
  formatted: Formatted
  /** `shot-{id}`, on the editable element. */
  id: string
  /** The element naming the Shot — *Shot 2 of The street*. */
  labelledby: string
  /** `editor.formattingOf`, already said, which names the toolbar. */
  label: string
  lang: string
  /** The guided path's mark, on the first Shot of the Scene written. */
  step?: string
  /** Where the caret lands: where the box was pressed, or at the end. */
  at: 'end' | { x: number, y: number }
  /** The bench's own keys, put to it first; true where it took the key. */
  keys: (event: KeyboardEvent, atHead: boolean) => boolean
  /**
   * Whether where the text stands is read: under `full` with an Image, or on a
   * card. Elsewhere the Layout places it, and the select is not offered.
   */
  standsRead: boolean
  /**
   * The Story's face and alignment, `setIn`'s: the face is inherited from here,
   * and the alignment is a class on the editable `.shot` itself, where the box it
   * replaced carried it, so a Story set centred is drawn centred in both.
   */
  setIn: ReturnType<typeof setIn>
}>()

const emit = defineEmits<{
  /** On every change: the plain words, and the text as it now stands, for whatever reads it live. */
  words: [text: string, formatted: Formatted]
  change: [formatted: Formatted]
}>()

const { t } = useI18n()
const host = useTemplateRef<HTMLElement>('host')
const bar = useTemplateRef<HTMLElement>('bar')

let editor: Editor | undefined

/** The editor's state as of its last transaction, which the toolbar is read from. */
const state = shallowRef<EditorState>()

/** Whether the text has changed since `change` last carried it. */
let unwritten = false

function write() {
  if (!editor || !unwritten) return
  unwritten = false
  // Said as a field says it, so the page lights the text the write came from:
  // `useEditing` hears a `change` on its way down to the element it is about.
  editor.view.dom.dispatchEvent(new Event('change', { bubbles: true }))
  const held = editor.getJSON() as Formatted
  const read = parseFormatted(held, 'refuse')
  emit('change', 'formatted' in read ? read.formatted : held)
}

/**
 * What the editable element carries, as the box it replaced carried it. Nothing
 * undefined is written, which ProseMirror would write as the word.
 */
const attributes = (): Record<string, string> => ({
  id: props.id,
  role: 'textbox',
  'aria-multiline': 'true',
  'aria-labelledby': props.labelledby,
  lang: props.lang,
  class: ['shot', props.setIn.class].filter(Boolean).join(' '),
  ...props.step && { 'data-step': props.step },
})

function handleKeyDown(view: EditorView, event: KeyboardEvent) {
  if (event.isComposing) return false
  const modified = event.metaKey || event.ctrlKey

  if (event.key === 'Enter' && !event.shiftKey && !modified) {
    write()
    return props.keys(event, false)
  }

  if (event.key === 'Backspace') {
    const { selection, doc } = view.state
    return props.keys(event, selection.empty && selection.from === Selection.atStart(doc).from)
  }

  if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && event.altKey && !modified) {
    return props.keys(event, false)
  }

  return false
}

/** The toolbar's height, which the text keeps clear above it when scrolled to. */
const height = ref(0)
let measuring: ResizeObserver | undefined

// Made when its element is drawn rather than on mount: a `.client` component is
// mounted as a placeholder first, and drawn in the same flush once it is.
watch(host, (element) => {
  if (element && !editor) open(element)
}, { flush: 'post' })

function open(element: HTMLElement) {
  const made = new Editor({
    element,
    // Tiptap's own stylesheet would set the text unlike the box it replaces —
    // its ligatures off, its spaces broken otherwise — and move a line under the
    // hand; what ProseMirror needs of the page is kept below instead.
    injectCSS: false,
    content: props.formatted,
    extensions: extensions(),
    editorProps: { attributes: attributes(), handleKeyDown },
    onTransaction: ({ editor: on }) => {
      state.value = on.state
    },
    onUpdate: ({ editor: on }) => {
      unwritten = true
      const now = on.getJSON() as Formatted
      emit('words', textOf(now), now)
    },
    onBlur: write,
  })
  editor = made

  const { view } = made
  const pressed = props.at === 'end' ? null : view.posAtCoords({ left: props.at.x, top: props.at.y })
  const { doc } = view.state
  view.dispatch(view.state.tr.setSelection(pressed ? Selection.near(doc.resolve(pressed.pos)) : Selection.atEnd(doc)))
  view.focus()
  // The box was brought into view as it took the focus, and the toolbar arrives
  // over it: a Shot at the head of the scroller brings its toolbar with it.
  bar.value!.scrollIntoView({ block: 'nearest' })

  measuring = new ResizeObserver(([entry]) => {
    height.value = entry!.borderBoxSize[0]!.blockSize
  })
  measuring.observe(bar.value!)
}

// What the box carried can change under the editor: the first Shot of the Scene
// written is no longer that once another Scene is. Only then: the bench draws
// itself again on every keystroke, and each time ProseMirror is handed its props
// it writes its selection back over the page's, taking a key just struck with it.
watch(() => JSON.stringify(attributes()), () => {
  editor?.view.setProps({ attributes: attributes() })
})

// The text as the server has it, put back when a refusal reads the Story back —
// `docs/adr/0008-refetch-is-for-a-refusal.md` — and out of the undo history, so
// `Mod+Z` cannot bring the refused text back to be sent again. The editor's own
// words coming back to it, and a read that brings back what it already holds,
// leave the text and its caret alone.
watch(() => props.formatted, (now) => {
  if (!editor || editor.schema.nodeFromJSON(now).eq(editor.state.doc)) return
  editor.chain().setMeta('addToHistory', false).setContent(now, { emitUpdate: false }).run()
  unwritten = false
})

onBeforeUnmount(() => {
  write()
  measuring?.disconnect()
  editor?.destroy()
})

// The toolbar.

const mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)

/** A key as the platform draws it — `⇧⌘E`, `Ctrl+⇧+E` — and as `aria-keyshortcuts` names it. */
const drawnKey = (key: string, shift = false) => mac
  ? `${shift ? t('editor.shiftKey') : ''}${t('editor.commandKey')}${key}`
  : [t('editor.controlKey'), ...shift ? [t('editor.shiftKey')] : [], key].join('+')
const namedKey = (key: string, shift = false) => [mac ? 'Meta' : 'Control', ...shift ? ['Shift'] : [], key].join('+')

type Toggle = {
  said: string
  /** A letter or two standing for the style, drawn in it where it reads on a letter. */
  glyph: string
  style: Style['type']
  attrs?: Record<string, string>
  drawn: [tag: string, attrs: Record<string, string>]
  key?: string
  shift?: boolean
}

const plain: Toggle['drawn'] = ['span', {}]

const TOGGLES: Toggle[] = [
  { said: 'editor.styleEmphasis', glyph: 'editor.glyphEmphasis', style: 'emphasis', drawn: STYLES.emphasis(undefined), key: 'I' },
  { said: 'editor.styleStrong', glyph: 'editor.glyphStrong', style: 'strong', drawn: STYLES.strong(undefined), key: 'B' },
  { said: 'editor.styleUnderline', glyph: 'editor.glyphUnderline', style: 'underline', drawn: STYLES.underline(undefined), key: 'U' },
  { said: 'editor.styleStrike', glyph: 'editor.glyphStrike', style: 'strike', drawn: STYLES.strike(undefined), key: 'S', shift: true },
  { said: 'editor.styleSmallCaps', glyph: 'editor.glyphSmallCaps', style: 'smallCaps', drawn: STYLES.smallCaps(undefined) },
  { said: 'editor.styleSuper', glyph: 'editor.glyphSuper', style: 'script', attrs: { place: 'super' }, drawn: plain, key: '.' },
  { said: 'editor.styleSub', glyph: 'editor.glyphSub', style: 'script', attrs: { place: 'sub' }, drawn: plain, key: ',' },
]

type Choice = {
  said: string
  /** Each option's value, its words, and the letter that sets it with `Shift` where one does. */
  options: [value: string, said: string, key?: string][]
  read: (state: EditorState) => string
  choose: (value: string, editor: Editor) => unknown
}

/** The keys a select's options are set by, for its `aria-keyshortcuts`. */
const shortcutsOf = (choice: Choice) =>
  choice.options.flatMap(([, , key]) => key ? [namedKey(key, true)] : []).join(' ') || undefined

const marked = (type: Style['type'], attr: string) => (on: EditorState) =>
  String(getMarkAttributes(on, type)[attr] ?? '')

const marks = (type: Style['type'], attrsOf: (value: string) => Record<string, unknown>) =>
  (value: string, on: Editor) => value ? on.commands.setMark(type, attrsOf(value)) : on.commands.unsetMark(type)

/** A colour is the letters' or a band's: one style, so a highlight replaces a colour. */
const inked = (band: boolean) => (on: EditorState) => {
  const { ink, band: banded } = getMarkAttributes(on, 'colour')
  return ink && banded === band ? String(ink) : ''
}

const lined = (attr: 'align' | 'leading') => ({
  read: (on: EditorState) => String(getNodeAttributes(on, 'line')[attr] ?? ''),
  choose: (value: string, on: Editor) => on.commands.updateAttributes('line', { [attr]: value || null }),
})

const INKED: Choice['options'] = [
  ['', 'editor.inkNone'],
  ['rose', 'editor.inkRose'],
  ['amber', 'editor.inkAmber'],
  ['green', 'editor.inkGreen'],
  ['blue', 'editor.inkBlue'],
  ['violet', 'editor.inkViolet'],
]

/** The selects, by what they act on: the words selected, their lines, the whole text. */
const CHOICES: Choice[][] = [
  [
    {
      said: 'editor.size',
      options: [
        ['small', 'editor.sizeSmall'],
        ['', 'editor.sizeNormal'],
        ['large', 'editor.sizeLarge'],
        ['larger', 'editor.sizeLarger'],
        ['largest', 'editor.sizeLargest'],
      ],
      read: marked('size', 'step'),
      choose: marks('size', step => ({ step })),
    },
    {
      said: 'editor.face',
      options: [
        ['', 'editor.asTheStoryIsSet'],
        ['prose', 'editor.faceProse'],
        ['display', 'editor.faceDisplay'],
        ['typewriter', 'editor.faceTypewriter'],
        ['hand', 'editor.faceHand'],
      ],
      read: marked('face', 'face'),
      choose: marks('face', face => ({ face })),
    },
    { said: 'editor.colour', options: INKED, read: inked(false), choose: marks('colour', ink => ({ ink, band: false })) },
    { said: 'editor.highlight', options: INKED, read: inked(true), choose: marks('colour', ink => ({ ink, band: true })) },
    {
      said: 'editor.spacing',
      options: [['', 'editor.spacingNormal'], ['wide', 'editor.spacingWide'], ['wider', 'editor.spacingWider']],
      read: marked('spacing', 'step'),
      choose: marks('spacing', step => ({ step })),
    },
    {
      said: 'editor.languageOfWords',
      options: [['', 'editor.languageOfStory'], ...STORY_LANGUAGES.map(lang => [lang, `languages.${lang}`] as [string, string])],
      read: marked('language', 'lang'),
      choose: marks('language', lang => ({ lang })),
    },
  ],
  [
    {
      said: 'editor.lineIs',
      options: [
        ['paragraph', 'editor.lineParagraph'],
        ['quote', 'editor.lineQuote'],
        ['source', 'editor.lineSource'],
        ['speech', 'editor.lineSpeech'],
        ['verse', 'editor.lineVerse'],
      ],
      read: on => lineKindOf(on) ?? '',
      choose: (kind, on) => lineAs(kind as LineKind)(on.state, on.view.dispatch),
    },
    {
      said: 'editor.align',
      options: [
        ['', 'editor.asTheStoryIsSet'],
        ['start', 'editor.alignStart', 'L'],
        ['centre', 'editor.alignCentre', 'E'],
        ['end', 'editor.alignEnd', 'R'],
      ],
      ...lined('align'),
    },
    {
      said: 'editor.leading',
      options: [['tight', 'editor.leadingTight'], ['', 'editor.leadingNormal'], ['loose', 'editor.leadingLoose']],
      ...lined('leading'),
    },
  ],
  [
    {
      said: 'editor.stands',
      options: [
        ['', 'editor.standsAsTheLayout'],
        ['top', 'editor.standsTop'],
        ['middle', 'editor.standsMiddle'],
        ['foot', 'editor.standsFoot'],
      ],
      read: on => on.doc.attrs.stands ?? '',
      choose: (stands, on) => on.view.dispatch(on.state.tr.setDocAttribute('stands', stands || null)),
    },
  ],
]

/** Where the text stands is offered only where something reads it. */
const choices = computed(() => props.standsRead ? CHOICES : CHOICES.slice(0, -1))

/** The source is offered on a quotation's last line, and where the caret is in one. */
const sourced = computed(() => !!state.value
  && (lineKindOf(state.value) === 'source' || lineAs('source')(state.value)))

/** The bar taken whole, whose words the field beside it says. */
const redaction = computed(() => {
  const selection = state.value?.selection
  return selection instanceof NodeSelection && selection.node.type.name === 'redaction' ? selection.node : undefined
})

const redactable = computed(() => !!state.value && redact(state.value))

/** The toggles' state, the caret's or the selection's. */
const pressed = (toggle: Toggle) => !!state.value && isMarkActive(state.value, toggle.style, toggle.attrs)

function press(toggle: Toggle) {
  if (!editor) return
  editor.commands.toggleMark(toggle.style, toggle.attrs)
  editor.view.focus()
}

/**
 * An act of the toolbar, and the caret back in the text — except after a bar is
 * made: the bar is held, so what it hides is asked next, and the focus goes to
 * the field that asks it, where a key struck cannot type over the bar.
 */
async function act(command: typeof redact) {
  if (!editor || !command(editor.state, editor.view.dispatch)) return
  if (command !== redact) return editor.view.focus()
  await nextTick()
  document.getElementById(`${props.id}-hides`)?.focus()
}

/**
 * Whether the toolbar was last worked by a key rather than by a press. A closed
 * select steps through its options under the arrows and the letters typed at it,
 * and on Windows and Linux says every step as a change: a change that came by a
 * key leaves the focus where the keys are, and only `Enter` or `Escape` takes it
 * back to the text, so a keyboard stepping through the sizes to the largest is
 * not thrown into the text at the first step (WCAG 3.2.2). A choice made by a
 * press hands the caret back at once.
 */
let keyed = false
const pointed = () => {
  keyed = false
}

function choose(choice: Choice, event: Event) {
  if (!editor) return
  const select = event.target as HTMLSelectElement
  choice.choose(select.value, editor)
  // A choice the text could not take — a speaker cannot be lifted alone — shows
  // what the text still holds rather than what was asked.
  select.value = choice.read(editor.state)
  if (!keyed) editor.view.focus()
}

function hide(event: Event) {
  if (!editor || !redaction.value) return
  const { state: now } = editor
  editor.view.dispatch(now.tr.setNodeAttribute(now.selection.from, 'hides', (event.target as HTMLInputElement).value))
}

/** The two sentences said of the words, in the order the Reader meets them. */
const SENTENCES = [
  { kind: 'arrives', said: 'editor.wordsArrive', effects: RUN_ARRIVALS, min: ARRIVES_OVER_MIN, max: ARRIVES_OVER_MAX },
  { kind: 'lasts', said: 'editor.wordsLast', effects: RUN_LASTINGS, min: LASTS_EVERY_MIN, max: LASTS_EVERY_MAX },
] as const

/** Whether there are words to say an Effect of, which is what the two buttons are offered on. */
const effectable = computed(() => !!state.value && !!wordsSaid(state.value))
const inRun = computed(() => !!state.value && takeEffectOff(state.value))

/** Whether the row of the two sentences is open. It closes when there are no words left to act on. */
const effecting = ref(false)
watch(effectable, (now) => {
  if (!now) effecting.value = false
})

/** What the words say for each sentence, read where the row writes it. */
const effectsHeld = computed(() => ({
  arrives: state.value && effectHeld(state.value, 'arrives'),
  lasts: state.value && effectHeld(state.value, 'lasts'),
}))

/**
 * An Effect said, and the caret back in the text where a press said it, as a
 * select's choice hands it back. Where it leaves no words to say one of, the row
 * goes with the control the keys were on, and the caret goes back to the text all
 * the same, rather than the focus to nowhere.
 */
function sayEffect(kind: 'arrives' | 'lasts', effect: Arrival | Lasting | null) {
  if (!editor) return
  runEffect(kind, effect)(editor.state, editor.view.dispatch)
  if (!keyed || !wordsSaid(editor.state)) editor.view.focus()
}

function chooseEffect(kind: 'arrives' | 'lasts', event: Event) {
  const value = (event.target as HTMLSelectElement).value
  sayEffect(kind, value ? effectWritten(value, kind, effectsHeld.value[kind]?.strength ?? 'marked') : null)
}

function timeEffect(kind: 'arrives' | 'lasts', event: Event) {
  const held = effectsHeld.value[kind]
  const written = held && secondsWritten(event, effectTime(held) ?? null)
  if (!held || written === undefined) return
  sayEffect(kind, { ...held, [kind === 'arrives' ? 'over' : 'every']: written } as Arrival | Lasting)
}

function strengthEffect(kind: 'arrives' | 'lasts', event: Event) {
  const held = effectsHeld.value[kind]
  if (held) sayEffect(kind, { ...held, strength: (event.target as HTMLSelectElement).value as Strength })
}

/**
 * One tab stop for the whole toolbar: `Tab` lands on the control used last, the
 * arrows walk the rest, and `Escape` puts the caret back in the text, as `Enter`
 * on a select does once its value is chosen.
 */
const FIRST = TOGGLES[0]!.said
const HIDES = 'editor.redactionHides'
const stop = ref(FIRST)
const roving = (name: string) => ({ 'data-stop': name, tabindex: stop.value === name ? 0 : -1 })

// A control that is gone takes the toolbar's one stop with it, so the stop goes
// back to the first: a bar's field once no bar is held, where the text stands once
// nothing reads it, the row of Effects once it closes, and a field in that row
// once the Effect it was said of has none.
watch([state, effecting, () => props.standsRead], () => {
  if (!bar.value?.querySelector(`[data-stop="${stop.value}"]`)) stop.value = FIRST
}, { flush: 'post' })

function landed(event: FocusEvent) {
  stop.value = (event.target as HTMLElement).dataset.stop ?? stop.value
}

function rove(event: KeyboardEvent) {
  if (event.key === 'Escape' || (event.key === 'Enter' && event.target instanceof HTMLSelectElement)) {
    event.preventDefault()
    editor?.view.focus()
    return
  }
  keyed = true
  // A bar's field keeps its arrows for its own caret. A field of seconds keeps
  // only the two that step its number, as a spin button in a toolbar does, so the
  // arrows along the toolbar still walk past it to the controls beyond.
  if (event.target instanceof HTMLInputElement && event.target.type !== 'number') return

  const stops = [...bar.value!.querySelectorAll<HTMLElement>('[data-stop]')]
  const at = stops.indexOf(event.target as HTMLElement)
  const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: stops.length - 1 }[event.key]
  if (to === undefined) return
  event.preventDefault()
  stops.at(to % stops.length)!.focus()
}
</script>

<template>
  <div class="formatting" :style="[setIn.style, { '--toolbar': `${height}px` }]">
    <div ref="host" />

    <!-- After the text, so `Tab` from the text lands on it, and drawn over the
         top of the text, where the eye already is. A press on a button leaves
         the focus — and the selection it shows — in the text. -->
    <div
      ref="bar"
      role="toolbar"
      class="toolbar"
      :aria-label="label"
      :aria-controls="id"
      @keydown="rove"
      @pointerdown="pointed"
      @focusin="landed"
    >
      <p v-if="redaction" class="hides">
        <label class="eyebrow" :for="`${id}-hides`">{{ $t('editor.redactionHides') }}</label>
        <input
          :id="`${id}-hides`"
          v-bind="roving(HIDES)"
          :value="redaction.attrs.hides"
          :maxlength="REDACTION_HIDES_MAX_LENGTH"
          @input="hide"
          @change="write"
        >
      </p>

      <!-- Each style a glyph drawn in it and the key it is set by, named in full
           for whoever cannot see the glyph and for the pointer that rests on it. -->
      <button
        v-for="toggle in TOGGLES"
        :key="toggle.said"
        type="button"
        v-bind="roving(toggle.said)"
        :aria-label="$t(toggle.said)"
        :title="$t(toggle.said)"
        :aria-pressed="pressed(toggle)"
        :aria-keyshortcuts="toggle.key ? namedKey(toggle.key, toggle.shift) : undefined"
        @mousedown.prevent
        @click="press(toggle)"
      >
        <component :is="toggle.drawn[0]" v-bind="toggle.drawn[1]" class="glyph">{{ $t(toggle.glyph) }}</component>
        <kbd v-if="toggle.key">{{ drawnKey(toggle.key, toggle.shift) }}</kbd>
      </button>

      <button
        type="button"
        v-bind="roving('editor.redact')"
        :aria-label="$t('editor.redact')"
        :title="$t('editor.redact')"
        :aria-disabled="redactable ? undefined : 'true'"
        @mousedown.prevent
        @click="act(redact)"
      >
        <span class="glyph">{{ $t('editor.glyphRedact') }}</span>
      </button>
      <button
        type="button"
        v-bind="roving('editor.addSeparator')"
        :aria-label="$t('editor.addSeparator')"
        :title="$t('editor.addSeparator')"
        @mousedown.prevent
        @click="act(addSeparator)"
      >
        <span class="glyph">{{ $t('editor.glyphSeparator') }}</span>
      </button>
      <button
        type="button"
        v-bind="roving('editor.addEffect')"
        :aria-label="$t('editor.addEffect')"
        :title="$t('editor.addEffect')"
        :aria-disabled="effectable ? undefined : 'true'"
        :aria-expanded="effecting"
        :aria-controls="effecting ? `${id}-effects` : undefined"
        @mousedown.prevent
        @click="effectable && (effecting = !effecting)"
      >
        <span class="glyph">{{ $t('editor.glyphAddEffect') }}</span>
      </button>
      <button
        type="button"
        v-bind="roving('editor.takeEffectOff')"
        :aria-label="$t('editor.takeEffectOff')"
        :title="$t('editor.takeEffectOff')"
        :aria-disabled="inRun ? undefined : 'true'"
        @mousedown.prevent
        @click="act(takeEffectOff)"
      >
        <span class="glyph">{{ $t('editor.glyphTakeEffectOff') }}</span>
      </button>

      <!-- Each select shows what it holds and is named by what it sets, so the
           toolbar wraps onto two rows at the bench's width rather than six. -->
      <template v-for="group in choices">
        <select
          v-for="choice in group"
          :key="choice.said"
          v-bind="roving(choice.said)"
          :aria-label="$t(choice.said)"
          :title="$t(choice.said)"
          :aria-keyshortcuts="shortcutsOf(choice)"
          :value="state && choice.read(state)"
          @change="choose(choice, $event)"
        >
          <template v-for="[value, said, key] in choice.options" :key="value">
            <option v-if="value !== 'source' || sourced" :value>
              {{ key ? `${$t(said)} ${drawnKey(key, true)}` : $t(said) }}
            </option>
          </template>
        </select>
      </template>

      <!-- What the words do as they arrive and while they stand, the two sentences
           a Shot's row says of its whole text, said here of the words selected or
           of the run the caret is in. Each writes as it changes, as the selects do.
           A sentence's seconds and strength are named by the sentence and their own
           label together, as the Shot's row names them, since each name is in the
           row twice. -->
      <div v-if="effecting" :id="`${id}-effects`" class="effects" role="group" :aria-label="$t('editor.addEffect')">
        <p v-for="sentence in SENTENCES" :key="sentence.kind" class="effect">
          <label :id="`${id}-${sentence.kind}-label`" class="eyebrow" :for="`${id}-${sentence.kind}`">
            {{ $t(sentence.said) }}
          </label>
          <select
            :id="`${id}-${sentence.kind}`"
            v-bind="roving(sentence.said)"
            :value="effectsHeld[sentence.kind]?.effect ?? ''"
            @change="chooseEffect(sentence.kind, $event)"
          >
            <option value="">{{ $t('editor.noEffect') }}</option>
            <option v-for="effect in sentence.effects" :key="effect" :value="effect">
              {{ $t(`editor.${EFFECT_LABELS[effect]}`) }}
            </option>
          </select>
          <template v-if="effectsHeld[sentence.kind]">
            <template v-if="effectTime(effectsHeld[sentence.kind]!) !== undefined">
              <label
                :id="`${id}-${sentence.kind}-seconds-label`"
                class="eyebrow"
                :for="`${id}-${sentence.kind}-seconds`"
              >
                {{ $t('editor.effectSeconds') }}
              </label>
              <input
                :id="`${id}-${sentence.kind}-seconds`"
                v-bind="roving(`${sentence.said}-seconds`)"
                :aria-labelledby="`${id}-${sentence.kind}-label ${id}-${sentence.kind}-seconds-label`"
                type="number"
                inputmode="decimal"
                :min="sentence.min / 1000"
                :max="sentence.max / 1000"
                step="0.1"
                :value="effectTime(effectsHeld[sentence.kind]!)! / 1000"
                @change="timeEffect(sentence.kind, $event)"
              >
            </template>
            <label
              :id="`${id}-${sentence.kind}-strength-label`"
              class="eyebrow"
              :for="`${id}-${sentence.kind}-strength`"
            >
              {{ $t('editor.effectStrength') }}
            </label>
            <select
              :id="`${id}-${sentence.kind}-strength`"
              v-bind="roving(`${sentence.said}-strength`)"
              :aria-labelledby="`${id}-${sentence.kind}-label ${id}-${sentence.kind}-strength-label`"
              :value="effectsHeld[sentence.kind]!.strength"
              @change="strengthEffect(sentence.kind, $event)"
            >
              <option v-for="strength in STRENGTHS" :key="strength" :value="strength">
                {{ $t(`editor.strength${strength[0]!.toUpperCase()}${strength.slice(1)}`) }}
              </option>
            </select>
          </template>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '~/assets/css/folds.css';

.formatting {
  position: relative;
}

/* The text is `.shot`, the reading face at the reading measure, with the two
   lines a beat always had, and kept clear of the toolbar when it is scrolled to,
   so a Shot brought to the top of the bench brings its toolbar with it. */
.formatting :deep(.ProseMirror) {
  min-block-size: 2lh;
  scroll-margin-block-start: calc(var(--toolbar, 0px) + var(--s2));
}

/* A bar or a separator taken whole is lit as the machine lights what it holds. */
.formatting :deep(.ProseMirror-selectednode) {
  outline: 2px solid var(--light);
  outline-offset: 1px;
}

/* What ProseMirror asks of the page, in place of the stylesheet Tiptap would
   inject: a bar or a separator taken whole shows neither the browser's caret nor
   its selection, the outline above saying it instead, and the empty image
   ProseMirror writes after a bar ending a line takes no room. How the text wraps
   is `.shot`'s, as it is the box's. */
.formatting :deep(.ProseMirror-hideselection *::selection) {
  background: transparent;
}

.formatting :deep(.ProseMirror-hideselection *) {
  caret-color: transparent;
}

.formatting :deep(img.ProseMirror-separator) {
  display: inline;
  inline-size: 0;
  block-size: 0;
  margin: 0;
  border: none;
}

/* Over the top of the text it acts on, on the bench's own ground, lifted off
   the document as a node is, and there only while the caret is in the text or
   in it — elsewhere it would lie over the very field being written in. Every
   control in view at every width: the toolbar wraps, and the text keeps clear of
   however many rows that makes. */
.toolbar {
  position: absolute;
  inset-block-end: 100%;
  inset-inline: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1);
  margin-block-end: var(--s1);
  padding: var(--s1);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
  box-shadow: var(--lifted);
  font-size: 0.75rem;
  transition: opacity 120ms ease-out;
}

.formatting:not(:focus-within) .toolbar {
  opacity: 0;
  pointer-events: none;
}

.toolbar button {
  display: inline-flex;
  align-items: center;
  gap: var(--s1);
  padding: var(--s1);
  font-size: inherit;
  white-space: nowrap;
}

/* A glyph is a letter, held to a letter's width so the row of them is even. */
.glyph {
  min-inline-size: 1.5ch;
  text-align: center;
}

/* A style the selection carries is lit: the interface saying what it holds. */
.toolbar [aria-pressed='true'] {
  border-color: var(--light);
  background: color-mix(in oklab, var(--light) 16%, var(--steel));
}

/* Reachable by the arrows still, so a keyboard learns it is there, and drawn
   as a disabled control is drawn. */
.toolbar [aria-disabled='true'],
.toolbar [aria-disabled='true']:hover {
  border-color: var(--edge);
  background: var(--steel);
  color: color-mix(in oklab, var(--muted) 60%, transparent);
  cursor: not-allowed;
}

.toolbar .small-caps {
  font-variant-caps: small-caps;
}

/* As wide as what it holds, so `Normal` takes a word's room and not the room of
   the longest option, and never wider than a short phrase. */
.toolbar select {
  field-sizing: content;
  inline-size: auto;
  max-inline-size: 7rem;
  padding: var(--s1);
  font-size: inherit;
  text-overflow: ellipsis;
}

/* The field a bar's words are written in takes a row of its own: it is the one
   thing the toolbar asks while a bar is held. */
.hides {
  display: grid;
  flex-basis: 100%;
  gap: 2px;
}

.hides input {
  padding: var(--s1) var(--s2);
  font-size: inherit;
}

/* The two sentences said of the words take a row of their own under the
   buttons, as a bar's field does, each sentence a line of its own. */
.effects {
  display: grid;
  flex-basis: 100%;
  gap: var(--s1);
}

.effect {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1);
}

.effects input {
  inline-size: 5ch;
  padding: var(--s1);
  font-size: inherit;
}

/* A phone has no keys to draw, and its column holds a third of the bench's: each
   toggle is its glyph alone — the key still named to whatever reads it — and
   each select a word or two. */
@media (--phone) {
  .toolbar kbd {
    display: none;
  }

  .toolbar select {
    max-inline-size: 5rem;
  }
}
</style>
