<script setup lang="ts">
/**
 * The Conditions one Exit or one Shot carries, a row apiece and all of them
 * holding for the Exit to be offered or the Shot to play: flat, so a Condition is
 * read as one sentence and the list is read as the whole of them. One carrying
 * none is offered to everyone, or played to everyone.
 *
 * One component for both, because the language is one language: a row that read
 * differently on a Shot than on an Exit would be two Condition editors to keep
 * alike. What differs is only what the row is called — `carrier` is the phrase
 * every label ends in, so a Story of forty Exits and two hundred Shots has no two
 * labels alike — and where the Scene a fresh visit count starts on comes from.
 *
 * The sentence is written the way one is read: the connecting words between the
 * fields are plain text, and every field's label is read by assistive technology
 * alone. Nothing an eye reads is lost, since the words the labels carried are the
 * words now set between the fields; what that buys, and what sizes the fields, is
 * said in the stylesheet at the foot of this file.
 *
 * The list is edited in place, on the Story the page fetched, and written whole
 * on every change: what the endpoint takes is the list, not a row of it.
 */
const { carrier, conditions, scenes, counting, id } = defineProps<{
  /** The visible words the list opens on: "Offered when", "Played when". */
  lead: string
  /** What carries the list, as a label ends it: "the Exit to The House", "Shot 3". */
  carrier: string
  /** The list itself, edited in place. */
  conditions: Condition[]
  /** The Scenes a visit count may name — the Story's own, and no other's. */
  scenes: Scene[]
  /** The Scene a freshly chosen visit count starts on. */
  counting: string
  /** The id of the Exit or Shot carrying the list, which every field's own id is built from. */
  id: string
}>()

/** Written whenever a row changes, and left to the page to send. */
const emit = defineEmits<{ write: [] }>()

const { t } = useI18n()

/** Which of the two things one Condition tests. */
type ConditionKind = 'flag' | 'visits'

function conditionKind(condition: Condition): ConditionKind {
  return 'flag' in condition ? 'flag' : 'visits'
}

const sceneNames = computed(() => new Map(scenes.map(scene => [scene.id, scene.name])))

/**
 * The name the bar of Commands shows the act of adding a Condition under: the
 * words on the button, and what carries the list after them. The carrier belongs
 * in the name here where it is left out of *Add a Shot*, because a Scene on the
 * writing surface draws one of these lists per Shot and one per way on — *Add a
 * Condition* four times over names nothing.
 *
 * One message rather than the button's own two put end to end, because a name in
 * the bar is a displayed string and those are written in the message files and
 * nowhere else: where the carrier falls in the sentence is the translator's to
 * settle, not this file's. See
 * `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
 */
const addNamed = computed(() => t('conditions.addTo', { carrier }))

/**
 * Adds a Condition. It starts as a Flag with no name, which is half a Condition
 * and which the server is right to refuse, so nothing is written until the name
 * is typed — or until the Author turns the row into a visit count, which is
 * whole the moment it is chosen. The cap is held here rather than by the control
 * alone, because the key that adds a row does not know the control is gone.
 */
function add() {
  if (conditions.length >= CONDITIONS_MAX) return

  conditions.push({ flag: '', is: '' })
  // The hand goes into the row that was just made, at the field the Author was
  // going to type in anyway: a fresh row is a Flag, which is the common kind, and
  // a row added and then hunted for is two gestures.
  nextTick(() => document.getElementById(`flag-${id}-${conditions.length - 1}`)?.focus())
}

/**
 * A Condition added from the keyboard, from inside the one being written, so
 * several in a row are one gesture repeated. What is typed is written first,
 * because the key that adds the row is prevented from doing what it otherwise
 * would and nothing else would commit the field.
 */
function addTyping() {
  emit('write')
  add()
}

function remove(place: number) {
  conditions.splice(place, 1)
  emit('write')
}

/**
 * Turns one row into a Condition of the other kind, and writes what that leaves:
 * a visit count is whole the moment it is chosen, and a Flag with no name yet is
 * a row the Story does not carry until it is typed. A visit count starts on the
 * Scene this thing belongs to, entered twice — the return the Author is writing
 * for, which is the common one.
 */
function choose(place: number, kind: ConditionKind) {
  conditions[place] = kind === 'flag'
    ? { flag: '', is: '' }
    : { scene: counting, visits: 'at least', times: 2 }

  emit('write')
}

/**
 * How one Condition is named where the row's own labels are too short to say it:
 * "Condition 2 of the Exit to The platform".
 */
function conditionCalled(place: number) {
  return t('conditions.called', { place: place + 1, carrier })
}
</script>

<template>
  <div class="conditions" :class="{ quiet: !conditions.length }">
    <!-- The words the list opens on, only where there is a list: a Shot carrying
         no Conditions — most of them — is the ordinary Shot, and the one control
         that puts a Condition on it is all the row says about it. -->
    <p v-if="conditions.length" class="eyebrow">
      {{ lead }}
      <span class="visually-hidden">— {{ carrier }}</span>
    </p>

    <div
      v-for="(condition, place) in conditions"
      :key="place"
      class="when reads"
      @keydown.enter.prevent="addTyping"
    >
      <!-- The sentence, and then the mark that strikes the whole of it out — a
           column of the row rather than the last field in the sentence, which is
           `.reads` in `frameline.css` and the shape a Flag's row is read in
           too. -->
      <div class="sentence">
        <span class="numbered" aria-hidden="true">{{ place + 1 }}</span>
        <label class="visually-hidden" :for="`when-${id}-${place}`">
          {{ conditionCalled(place) }}
        </label>
        <select
          :id="`when-${id}-${place}`"
          :value="conditionKind(condition)"
          @change="choose(place, ($event.target as HTMLSelectElement).value as ConditionKind)"
        >
          <option value="flag">{{ $t('conditions.flag') }}</option>
          <option value="visits">{{ $t('conditions.scene') }}</option>
        </select>

        <template v-if="'flag' in condition">
          <label class="visually-hidden" :for="`flag-${id}-${place}`">
            {{ $t('conditions.flag') }}
            {{ $t('conditions.ofCarrier', { carrier: conditionCalled(place) }) }}
          </label>
          <input
            :id="`flag-${id}-${place}`"
            v-model="condition.flag"
            class="data"
            size="8"
            :maxlength="FLAG_NAME_MAX_LENGTH"
            @change="emit('write')"
          >
          <span class="says" aria-hidden="true">{{ $t('conditions.holds') }}</span>
          <label class="visually-hidden" :for="`is-${id}-${place}`">
            {{ $t('conditions.holds') }}
            {{ $t('conditions.forCondition', { condition: conditionCalled(place) }) }}
          </label>
          <input
            :id="`is-${id}-${place}`"
            v-model="condition.is"
            class="data"
            size="8"
            :maxlength="FLAG_VALUE_MAX_LENGTH"
            @change="emit('write')"
          >
        </template>

        <template v-else>
          <label class="visually-hidden" :for="`counted-${id}-${place}`">
            {{ $t('conditions.scene') }}
            {{ $t('conditions.countedBy', { condition: conditionCalled(place) }) }}
          </label>
          <select
            :id="`counted-${id}-${place}`"
            v-model="condition.scene"
            class="counted"
            @change="emit('write')"
          >
            <!-- A Scene deleted since the Condition was written is still what it
                 counts, and saying so beats showing the Author a Scene they never
                 chose. -->
            <option v-if="!sceneNames.get(condition.scene)" :value="condition.scene">
              {{ $t('scene.goneOption') }}
            </option>
            <option v-for="counted in scenes" :key="counted.id" :value="counted.id">
              {{ counted.name }}
            </option>
          </select>
          <span class="says" aria-hidden="true">{{ $t('conditions.entered') }}</span>
          <label class="visually-hidden" :for="`visits-${id}-${place}`">
            {{ $t('conditions.entered') }}
            {{ $t('conditions.forCondition', { condition: conditionCalled(place) }) }}
          </label>
          <select
            :id="`visits-${id}-${place}`"
            v-model="condition.visits"
            @change="emit('write')"
          >
            <option value="at least">{{ $t('conditions.atLeast') }}</option>
            <option value="fewer than">{{ $t('conditions.fewerThan') }}</option>
          </select>
          <label class="visually-hidden" :for="`times-${id}-${place}`">
            {{ $t('conditions.times') }}
            {{ $t('conditions.forCondition', { condition: conditionCalled(place) }) }}
          </label>
          <input
            :id="`times-${id}-${place}`"
            v-model.number="condition.times"
            class="times data"
            type="number"
            min="1"
            :max="VISITS_MAX"
            @change="emit('write')"
          >
          <span class="says" aria-hidden="true">{{ $t('conditions.times') }}</span>
        </template>
      </div>

      <button type="button" class="danger mark" @click="remove(place)">
        <span aria-hidden="true">×</span>
        <span class="visually-hidden">
          {{ $t('conditions.remove', { place: place + 1 }) }}
          {{ $t('conditions.ofCarrier', { carrier }) }}
        </span>
      </button>
    </div>

    <button
      v-if="conditions.length < CONDITIONS_MAX"
      type="button"
      class="mark add"
      :data-command="addNamed"
      @click="add"
    >
      {{ $t('conditions.add') }}
      <span class="visually-hidden">{{ $t('conditions.toCarrier', { carrier }) }}</span>
    </button>
  </div>
</template>

<style scoped>
/* The Conditions of one Exit or one Shot, stacked, each read across its own row as
   the sentence it is: "played when — Flag — coat — holds — on". The connecting
   words are plain text between the fields and the labels are read by assistive
   technology alone, because a visible label over every one of five controls is
   what turned one sentence into five lines in a node the width of a phone. */
.conditions {
  display: grid;
  gap: var(--s1);
}

/* A Shot carrying no Conditions is the ordinary Shot: the whole list is one quiet
   line — what holds, and the way to change it — and it grows into a column the
   moment there is a Condition in it. */
.conditions.quiet {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s1) var(--s2);
}

/* The control that adds one, at the size and in the place it has whether the list
   holds none or five: as wide as its words and no wider, sat at the leading edge.
   It used to be that small line only where there was nothing in the list and a
   button across the whole width under one — two shapes for one act, on rows a
   Scene reads together, and the wide one read as though the button were the
   subject of the list above it. That is what the control that adds a Flag and the
   one that adds a beat both refuse, for the same reason.
   Two rules do it, because the list is laid out two ways: the quiet line above is
   a flex row, where a button is already only as wide as its words, and a list
   with a Condition in it is a grid, where `justify-self` is what stops the lone
   button stretching across the column. */
.conditions .add {
  justify-self: start;
  padding: 0 var(--s2);
  font-size: 0.7rem;
}

/* Each field is as wide as what is in it and no wider — `field-sizing` where the
   browser has it, and the `size` attribute on the two typed fields where it does
   not, so a Condition still reads across one row rather than the twenty
   characters an input asks for by default. */
.when select,
.when input {
  field-sizing: content;
  inline-size: auto;
  min-inline-size: 3rem;
  max-inline-size: 100%;
  padding: var(--s1);
  font-size: 0.75rem;
}

/* A Scene's name is the Author's to write and can be long: the field says as much
   of it as the row has room for rather than pushing the rest of the sentence off
   the line, so a visit count reads across two lines at worst. */
.when .counted {
  max-inline-size: 6rem;
}

/* The count of visits, wide enough for the three digits of `VISITS_MAX` and not
   for the twenty characters a number field asks for by default. Written out
   rather than left to `field-sizing`, so the field is the same width in a browser
   that has neither — and a count between one and a hundred has nothing to gain
   from growing. */
.when .times {
  inline-size: 3.5rem;
}

/* The Condition's own number, in the gutter of its row — what the Author refers
   to it by — and the connecting words between its fields, which are the sentence
   itself and not a label of anything: both stencilled on the machine, the way
   every other word around a field here is. */
.numbered,
.says {
  color: var(--muted);
  font-family: var(--data);
}

.numbered {
  font-variant-numeric: tabular-nums;
}

/* Data the Author types rather than prose: a Condition's two sides, the count of
   visits. */
.data {
  font-family: var(--data);
}
</style>
