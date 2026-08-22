<script setup lang="ts">
/**
 * The Conditions one Cut or one Shot carries, a row apiece and all of them
 * holding for the Cut to be offered or the Shot to play: flat, so a Condition is
 * read as one sentence and the list is read as the whole of them. One carrying
 * none is offered to everyone, or played to everyone.
 *
 * One component for both, because the language is one language: a row that read
 * differently on a Shot than on a Cut would be two Condition editors to keep
 * alike. What differs is only what the row is called — `carrier` is the phrase
 * every label ends in, so a Story of forty Cuts and two hundred Shots has no two
 * labels alike — and where the Scene a fresh visit count starts on comes from.
 *
 * The list is edited in place, on the Story the page fetched, and written whole
 * on every change: what the endpoint takes is the list, not a row of it.
 */
const { carrier, conditions, scenes, counting } = defineProps<{
  /** The visible words the list opens on: "Offered when", "Played when". */
  lead: string
  /** What carries the list, as a label ends it: "the Cut to The House", "Shot 3". */
  carrier: string
  /** The list itself, edited in place. */
  conditions: Condition[]
  /** The Scenes a visit count may name — the Story's own, and no other's. */
  scenes: Scene[]
  /** The Scene a freshly chosen visit count starts on. */
  counting: string
  /** The id of the Cut or Shot carrying the list, which every field's own id is built from. */
  id: string
}>()

/** Written whenever a row changes, and left to the page to send. */
const emit = defineEmits<{ write: [] }>()

/** Which of the two things one Condition tests. */
type ConditionKind = 'flag' | 'visits'

function conditionKind(condition: Condition): ConditionKind {
  return 'flag' in condition ? 'flag' : 'visits'
}

const sceneNames = computed(() => new Map(scenes.map(scene => [scene.id, scene.name])))

/**
 * Adds a Condition. It starts as a Flag with no name, which is half a Condition
 * and which the server is right to refuse, so nothing is written until the name
 * is typed — or until the Author turns the row into a visit count, which is
 * whole the moment it is chosen.
 */
function add() {
  conditions.push({ flag: '', is: '' })
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
 * "Condition 2 of the Cut to The platform".
 */
function conditionCalled(place: number) {
  return `Condition ${place + 1} of ${carrier}`
}
</script>

<template>
  <div class="conditions">
    <p class="eyebrow">
      {{ lead }}
      <span class="visually-hidden">— {{ carrier }}</span>
      <template v-if="!conditions.length">— always</template>
    </p>

    <div v-for="(condition, place) in conditions" :key="place" class="when">
      <label class="eyebrow" :for="`when-${id}-${place}`">
        Condition {{ place + 1 }}
        <span class="visually-hidden">of {{ carrier }}</span>
      </label>
      <select
        :id="`when-${id}-${place}`"
        :value="conditionKind(condition)"
        @change="choose(place, ($event.target as HTMLSelectElement).value as ConditionKind)"
      >
        <option value="flag">A Flag holds</option>
        <option value="visits">A Scene has been entered</option>
      </select>

      <template v-if="'flag' in condition">
        <label class="eyebrow" :for="`flag-${id}-${place}`">
          Flag
          <span class="visually-hidden">of {{ conditionCalled(place) }}</span>
        </label>
        <input
          :id="`flag-${id}-${place}`"
          v-model="condition.flag"
          class="data"
          :maxlength="FLAG_NAME_MAX_LENGTH"
          @change="emit('write')"
        >
        <label class="eyebrow" :for="`is-${id}-${place}`">
          holds
          <span class="visually-hidden">for {{ conditionCalled(place) }}</span>
        </label>
        <input
          :id="`is-${id}-${place}`"
          v-model="condition.is"
          class="data"
          :maxlength="FLAG_VALUE_MAX_LENGTH"
          @change="emit('write')"
        >
      </template>

      <template v-else>
        <label class="eyebrow" :for="`counted-${id}-${place}`">
          Scene
          <span class="visually-hidden">counted by {{ conditionCalled(place) }}</span>
        </label>
        <select
          :id="`counted-${id}-${place}`"
          v-model="condition.scene"
          @change="emit('write')"
        >
          <!-- A Scene deleted since the Condition was written is still what it
               counts, and saying so beats showing the Author a Scene they never
               chose. -->
          <option v-if="!sceneNames.get(condition.scene)" :value="condition.scene">
            A Scene that is gone
          </option>
          <option v-for="counted in scenes" :key="counted.id" :value="counted.id">
            {{ counted.name }}
          </option>
        </select>
        <label class="eyebrow" :for="`visits-${id}-${place}`">
          entered
          <span class="visually-hidden">for {{ conditionCalled(place) }}</span>
        </label>
        <select
          :id="`visits-${id}-${place}`"
          v-model="condition.visits"
          @change="emit('write')"
        >
          <option value="at least">at least</option>
          <option value="fewer than">fewer than</option>
        </select>
        <label class="eyebrow" :for="`times-${id}-${place}`">
          times
          <span class="visually-hidden">for {{ conditionCalled(place) }}</span>
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
      </template>

      <button type="button" class="danger" @click="remove(place)">
        Remove Condition {{ place + 1 }}
        <span class="visually-hidden">of {{ carrier }}</span>
      </button>
    </div>

    <button v-if="conditions.length < CONDITIONS_MAX" type="button" @click="add">
      Add a Condition
      <span class="visually-hidden">to {{ carrier }}</span>
    </button>
  </div>
</template>

<style scoped>
/* The Conditions of one Cut or one Shot, stacked, each read across its own row as
   the sentence it is: "offered when a Flag holds — coat — on". */
.conditions {
  display: grid;
  gap: var(--s1);
}

.when {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s2);
}

.when select,
.when input {
  inline-size: auto;
  flex: 1 1 6rem;
  padding: var(--s1) var(--s2);
  font-size: 0.8125rem;
}

.when .times {
  flex: 0 0 4.5rem;
}

/* Data the Author types rather than prose: a Condition's two sides, the count of
   visits. */
.data {
  font-family: var(--data);
  font-size: 0.8125rem;
}
</style>
