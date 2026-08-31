<script setup lang="ts">
/**
 * The Flags one Scene sets on entry, a row apiece: a name, and the values one of
 * which is drawn each time a Reading enters the Scene. Written on the idiom the
 * Conditions are written on — a row of fields with the connecting words between
 * them as plain text, every field's label read by assistive technology alone —
 * because a Flag and a Condition are data of the same kind and used to be typed
 * two different ways, one of them a syntax.
 *
 * Nothing an Author types here carries punctuation. What the Scene stores is
 * unchanged: a map of names to a value or a list of values, and every limit on a
 * name, a value and their count stays the server's to enforce.
 */
const { sets, scene, id } = defineProps<{
  /** The Flags the Scene sets, as the Story on the bench carries them. */
  sets: Sets
  /** The Scene's name, which every label here ends in. */
  scene: string
  /** The Scene's id, which every field's own id is built from. */
  id: string
}>()

/** The Flags the rows now amount to, left to the page to send. */
const emit = defineEmits<{ write: [Sets] }>()

const { t } = useI18n()

/**
 * The rows on screen, which are not quite what the Scene stores: a row is
 * written before it is whole — a name with no value yet, a value halfway
 * retyped — and a map has nowhere to hold one. So the rows are held here and the
 * Flags they amount to are what leaves.
 *
 * Taken again from the Story whenever the Story is not what the rows say: that is
 * the read that follows a refusal, which is the one moment where what persisted
 * beats what was typed — see `docs/adr/0008-refetch-is-for-a-refusal.md`. A write
 * that landed leaves the two in step, so the rows an Author is typing in are left
 * alone.
 */
const rows = ref(flagRows(sets))

watch(() => sets, (written) => {
  if (JSON.stringify(flagsSet(rows.value)) !== JSON.stringify(written)) {
    rows.value = flagRows(written)
  }
})

function write() {
  emit('write', flagsSet(rows.value))
}

/** Puts the hand in a field the press or the key has just made. */
function typeIn(field: string) {
  nextTick(() => document.getElementById(field)?.focus())
}

/**
 * Adds a Flag, empty. The cap is held here as well as by the control, because the
 * key that adds a row from inside one does not know the control is gone.
 */
function add() {
  if (rows.value.length >= FLAGS_PER_SCENE) return

  rows.value.push({ name: '', values: [''] })
  typeIn(`flag-${id}-${rows.value.length - 1}`)
}

/**
 * A Flag added from the keyboard, from inside the one being written: what is
 * typed is written first, because the key that adds the row is prevented from
 * doing what it otherwise would and the field would not be committed by anything
 * else.
 */
function addTyping() {
  write()
  add()
}

function remove(place: number) {
  rows.value.splice(place, 1)
  write()
}

function addValue(row: FlagRow, place: number) {
  row.values.push('')
  typeIn(`value-${id}-${place}-${row.values.length - 1}`)
}

function removeValue(row: FlagRow, at: number) {
  row.values.splice(at, 1)
  write()
}

/**
 * How one Flag is named where the row's own labels are too short to say it:
 * "Flag 2 set on entering The platform".
 */
function flagCalled(place: number) {
  return t('flags.called', { place: place + 1, scene })
}
</script>

<template>
  <div class="flags">
    <!-- Only where there are none. What the list is, and which Scene sets it, is
         said by the heading of the section it stands in — see `Panel.vue`, where
         the three parts of a Scene each carry their own — and saying it twice
         over was what taking the tabs out left behind. -->
    <p v-if="!rows.length" class="eyebrow none">{{ $t('flags.none') }}</p>

    <div v-for="(row, place) in rows" :key="place" class="sets" @keydown.enter.prevent="addTyping">
      <span class="numbered" aria-hidden="true">{{ place + 1 }}</span>
      <label class="visually-hidden" :for="`flag-${id}-${place}`">
        {{ $t('flags.name', { flag: flagCalled(place) }) }}
      </label>
      <input
        :id="`flag-${id}-${place}`"
        v-model="row.name"
        class="data"
        size="8"
        :maxlength="FLAG_NAME_MAX_LENGTH"
        @change="write"
      >
      <span class="says" aria-hidden="true">{{ $t('flags.holds') }}</span>

      <!-- The values a Flag is drawn from, one of them on each entry: the word
           between them is what the draw does, so a row of three reads as a
           choice rather than as three fields in a row. A row of one has nothing
           to take away, so it is not offered. -->
      <template v-for="(value, at) in row.values" :key="at">
        <span v-if="at" class="says" aria-hidden="true">{{ $t('flags.or') }}</span>
        <label class="visually-hidden" :for="`value-${id}-${place}-${at}`">
          {{ $t('flags.value', { place: at + 1, flag: flagCalled(place) }) }}
        </label>
        <input
          :id="`value-${id}-${place}-${at}`"
          v-model="row.values[at]"
          class="data"
          size="8"
          :maxlength="FLAG_VALUE_MAX_LENGTH"
          @change="write"
        >
        <button
          v-if="row.values.length > 1"
          type="button"
          class="danger strike"
          @click="removeValue(row, at)"
        >
          <span aria-hidden="true">×</span>
          <span class="visually-hidden">
            {{ $t('flags.removeValue', { place: at + 1, flag: flagCalled(place) }) }}
          </span>
        </button>
      </template>

      <button
        v-if="row.values.length < FLAG_VALUES_MAX"
        type="button"
        class="strike"
        @click="addValue(row, place)"
      >
        <span aria-hidden="true">+</span>
        <span class="visually-hidden">
          {{ $t('flags.addValue', { flag: flagCalled(place) }) }}
        </span>
      </button>

      <button type="button" class="danger strike" @click="remove(place)">
        <span aria-hidden="true">×</span>
        <span class="visually-hidden">{{ $t('flags.remove', { flag: flagCalled(place) }) }}</span>
      </button>
    </div>

    <button v-if="rows.length < FLAGS_PER_SCENE" type="button" class="add" @click="add">
      {{ $t('flags.add') }}
      <span class="visually-hidden">{{ $t('editor.toScene', { name: scene }) }}</span>
    </button>
  </div>
</template>

<style scoped>
/* The Flags a Scene sets, stacked, each read across its own row as the sentence
   it is: "coat — holds — on", and "weather — holds — rain — or — sun". The words
   between the fields are plain text and the labels are read by assistive
   technology alone, which is what the Conditions of an Exit already do a few
   rows further down — the two lists are one language and are not going to look
   like two. */
/* The control that adds a Flag is as wide as its words and no wider, like every
   other control on this surface: a button across the whole width reads as the
   subject of the section it sits under. */
.flags .add {
  justify-self: start;
}

.flags {
  display: grid;
  gap: var(--s1);
}

.sets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1);
  font-size: 0.75rem;
}

/* Each field is as wide as what is in it and no wider — `field-sizing` where the
   browser has it, and the `size` attribute where it does not, so a Flag of two
   short words still reads across one row rather than the twenty characters an
   input asks for by default. */
.sets input {
  field-sizing: content;
  inline-size: auto;
  min-inline-size: 3rem;
  max-inline-size: 100%;
  padding: var(--s1);
  font-size: 0.75rem;
}

/* The Flag's own number, in the gutter of its row, and the connecting words
   between its fields, which are the sentence itself and not a label of
   anything. */
.numbered,
.says {
  color: var(--muted);
  font-family: var(--data);
}

.numbered {
  font-variant-numeric: tabular-nums;
}

/* The marks a row and a value are taken off by, and the one a value is added by:
   a mark rather than a sentence, the way a Condition's is. */
.strike {
  padding: 0 var(--s2);
}

/* Data the Author types rather than prose: a Flag's name and its values. */
.data {
  font-family: var(--data);
}
</style>
