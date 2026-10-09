<script setup lang="ts">
/**
 * One way on of the document: its Place, where it leads and the mark that goes
 * there, the words the Reader presses, how often Readers took it, the Conditions
 * it is offered under, whether it is crossed backwards, how its passage is cut,
 * and its marks — the row `app/components/Writing.vue` draws for every Exit at the
 * foot of the Scene it leaves. A component of its own for the reason
 * `app/components/ShotRow.vue` is one: it reads its own Exit, and is handed
 * otherwise only values that are primitive or kept while they say the same, so an
 * act elsewhere in the Story hands it nothing new — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md` and issue #449.
 *
 * What writes nothing but this Exit is written here. Going to the Scene it leads to
 * and renumbering the ways on are the document's, asked of it by an event.
 */
const { name, toName, changing, writing, announce } = defineProps<{
  /** The Exit itself, typed into where it is drawn. */
  exit: Exit
  /** The Scene it leaves, whose ways on it is one of. */
  scene: Scene
  /** Its Place among them, counted from nought. */
  place: number
  /** Whether it is the last of them, which has no later Place to move to. */
  last: boolean
  /** What the bench calls the Scene it leaves, and the one it leads to, which every control of the row is named by. */
  name: string
  toName: string
  /** Whether the caret is in the Scene it leaves, which is what carries a mark's name. */
  here: boolean
  /** How often Readers took it, while the Story is published. */
  taken?: string
  /** What the bench calls each Scene and each Exit, and the Flags of the Story, which its Conditions offer. */
  names: Map<string, string>
  exits: Map<string, ExitOnTheBench>
  flags: ReadonlySet<string>
  /** The Scenes and the Exits of the Story as `Landing` reads them, which say where it may be led. */
  landing: { scenes: Pick<Scene, 'id' | 'name'>[], exits: Pick<Exit, 'fromSceneId' | 'toSceneId'>[] }
  /** The document's own two doors, which say a refusal in the Scene the act was in. */
  changing: (scene: Scene, act: () => Promise<unknown>) => Promise<boolean>
  writing: (scene: Scene, written: string, act: () => Promise<unknown>) => Promise<void>
  /** What the bench has just done, said once and gone. */
  announce: (said: string) => void
}>()

/** What the row asks of the document: `open` the Scene it leads to, and `move` it a Place earlier or later. */
const emit = defineEmits<{ open: [string], move: [-1 | 1] }>()

const { t } = useI18n()

/** Where a way on leads, changed in the field that says where it leads: the Exit keeps its text, its Conditions and its Place. */
function leadExit(scene: Scene, exit: Exit, toSceneId: string) {
  if (!toSceneId || toSceneId === exit.toSceneId) return

  return changing(scene, () => send(`/api/exits/${exit.id}/scene`, {
    method: 'PUT',
    body: { toSceneId },
  }))
}

/** The words the Reader reads on the button that takes the way on. A typed write, like a Shot's text. */
function writeExitText(scene: Scene, exit: Exit) {
  return writing(scene, exit.id, () => send(`/api/exits/${exit.id}`, {
    method: 'PATCH',
    body: { text: exit.text },
  }))
}

/**
 * Whether a Reading crosses this Exit backwards. Three answers in one field —
 * the Exit's own yes, its own no, and the Story's, which is what an Exit answers
 * until the Author says otherwise — so the select reads and writes the null the
 * column holds rather than a pair of switches that could disagree. See
 * `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`.
 */
function crossedBack(exit: Exit) {
  return exit.stepsBack === null ? 'story' : exit.stepsBack ? 'yes' : 'no'
}

function writeCrossedBack(scene: Scene, exit: Exit, answer: string) {
  exit.stepsBack = answer === 'story' ? null : answer === 'yes'

  return writing(scene, exit.id, () => send(`/api/exits/${exit.id}`, {
    method: 'PATCH',
    body: { stepsBack: exit.stepsBack },
  }))
}

/**
 * What the Exit says about its passage, put on the Exit before the request leaves,
 * as `writeSceneCut` in `Writing.vue` says why.
 */
function writeExitCut(
  scene: Scene, exit: Exit, body: Partial<Pick<Exit, 'cutOver' | 'cutThrough'>>,
) {
  if (!wholeCut(body)) return
  Object.assign(exit, body)

  return writing(scene, exit.id, () => send(`/api/exits/${exit.id}`, { method: 'PATCH', body }))
}

/**
 * Writes a second way on to the same Scene, carrying the Conditions of the first:
 * two ways on to one Scene under opposite Conditions is what Conditions on an Exit
 * are for, so it is written on purpose here. The text is not copied — the second
 * is offered under opposite tests and phrased from scratch. How it is crossed is
 * copied, backwards or not and the passage it cuts through, since it is crossed
 * into the same Scene (#344).
 */
function duplicateExit(scene: Scene, exit: Exit) {
  const conditions = wholeConditions(exit.conditions)
  const { stepsBack, cutOver, cutThrough } = exit

  return changing(scene, async () => {
    const written = await send(`/api/scenes/${scene.id}/exits`, {
      method: 'POST',
      body: { toSceneId: exit.toSceneId },
    }) as Exit

    if (conditions.length) {
      await send(`/api/exits/${written.id}/conditions`, { method: 'PUT', body: { conditions } })
    }

    if (stepsBack !== null || cutOver) {
      await send(`/api/exits/${written.id}`, {
        method: 'PATCH',
        body: { stepsBack, cutOver, cutThrough },
      })
    }

    announce(t('editor.exitDuplicated', {
      from: name,
      to: toName,
    }))
  })
}

/** No confirmation: the control is named for what it takes, which is not the slip of a hand. */
function deleteExit(scene: Scene, exit: Exit) {
  return changing(scene, () => send(`/api/exits/${exit.id}`, { method: 'DELETE' }))
}

/** Writes the whole list the Exit carries, which is what the endpoint takes. */
function writeConditions(scene: Scene, exit: Exit) {
  return writing(scene, exit.id, () => send(`/api/exits/${exit.id}/conditions`, {
    method: 'PUT',
    body: { conditions: wholeConditions(exit.conditions) },
  }))
}
</script>

<template>
  <li class="handed" :data-way="exit.id">
    <span class="numbered">{{ place + 1 }}</span>

    <div class="written">
      <!-- Where the way on leads, in a field that says so, and beside it
           the mark that goes there: the Scene at the far end is one press
           away from the section that names it. -->
      <p class="arrival">
        <label class="visually-hidden" :for="`leads-${exit.id}`">
          {{ $t('editor.wayOnLeadsTo', { place: place + 1, name: name }) }}
        </label>
        <select
          :id="`leads-${exit.id}`"
          :value="exit.toSceneId"
          @change="leadExit(
            scene, exit, ($event.target as HTMLSelectElement).value)"
        >
          <Landing
            :scenes="landing.scenes"
            :exits="landing.exits"
            :from="scene.id"
            :led="exit.toSceneId"
            :names
          />
        </select>
        <button
          type="button"
          class="mark"
          @click="emit('open', exit.toSceneId)"
        >
          <span aria-hidden="true">→</span>
          <span class="visually-hidden">
            {{ $t('editor.goToSceneByExit', {
              name: toName,
              place: place + 1,
              scene: name,
            }) }}
          </span>
        </button>
      </p>

      <!-- The words the Reader reads on the button. -->
      <p class="said">
        <label class="visually-hidden" :for="`exit-${exit.id}`">
          {{ $t('editor.wayOnSays', { place: place + 1, name: name }) }}
        </label>
        <input
          :id="`exit-${exit.id}`"
          v-model="exit.text"
          :maxlength="EXIT_TEXT_MAX_LENGTH"
          :placeholder="$t('editor.whatTheReaderPresses')"
          @change="writeExitText(scene, exit)"
        >
      </p>

      <!-- How often Readers took it, which its Author is told here and
           nowhere a Reader looks. -->
      <p v-if="taken" class="eyebrow read-mark taken">{{ taken }}</p>

      <div class="beneath">
        <Conditions
          :lead="$t('editor.offeredWhen')"
          :carrier="$t('editor.theWayOnTo', {
            place: place + 1,
            scene: toName,
            from: name,
          })"
          :conditions="exit.conditions"
          :names
          :exits="exits"
          :flags="flags"
          :counting="scene.id"
          :id="exit.id"
          :named="here"
          @write="writeConditions(scene, exit)"
        />

        <!-- Whether the Reader may come back through this Exit, beside
             the tests it is offered under: both are what the Author says
             about this way on and neither is what it says. Named for the
             Exit it belongs to, because two Exits of one Scene leading to
             one Scene would otherwise answer to the same words — see
             issue #276. -->
        <p class="crossing">
          <label class="eyebrow" :for="`back-${exit.id}`">
            {{ $t('editor.steppingBack') }}
            <span class="visually-hidden">
              {{ $t('editor.theWayOnTo', {
                place: place + 1,
                scene: toName,
                from: name,
              }) }}
            </span>
          </label>
          <select
            :id="`back-${exit.id}`"
            :value="crossedBack(exit)"
            @change="writeCrossedBack(
              scene,
              exit,
              ($event.target as HTMLSelectElement).value,
            )"
          >
            <option value="story">{{ $t('editor.steppingBackAsStory') }}</option>
            <option value="yes">{{ $t('editor.steppingBackOffered') }}</option>
            <option value="no">{{ $t('editor.steppingBackRefused') }}</option>
          </select>
        </p>

        <!-- How the passage out of the Scene is made, and never when: an
             Exit is taken rather than held, so there is nothing here to
             say how long it stands — the Scene says that of all of them
             at once. It answers for itself with no Scene behind it, which
             is why there is no *as the Scene says* among the three: see
             `0050`. -->
        <p class="cutting">
          <label class="eyebrow" :for="`exit-cut-over-${exit.id}`">
            {{ $t('editor.cutIsMade') }}
            <span class="visually-hidden">
              {{ $t('editor.theWayOnTo', {
                place: place + 1,
                scene: toName,
                from: name,
              }) }}
            </span>
          </label>
          <select
            :id="`exit-cut-over-${exit.id}`"
            :value="cutKind(exit)"
            @change="writeExitCut(
              scene, exit, cutMade(($event.target as HTMLSelectElement).value))"
          >
            <option value="hard">{{ $t('editor.cutHard') }}</option>
            <option value="image">{{ $t('editor.cutThroughImage') }}</option>
            <option value="black">{{ $t('editor.cutThroughBlack') }}</option>
          </select>
          <template v-if="exit.cutOver > 0">
            <input
              type="number"
              inputmode="decimal"
              min="0.1"
              :max="CUT_OVER_MAX / 1000"
              step="0.1"
              :value="exit.cutOver / 1000"
              :aria-label="$t('editor.secondsTheExitsCutTakes', {
                place: place + 1,
                scene: toName,
                from: name,
              })"
              @change="writeExitCut(scene, exit, {
                cutOver: secondsWritten($event, exit.cutOver),
              })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
          </template>
        </p>

        <div class="row">
          <button
            type="button"
            class="mark"
            :disabled="place === 0"
            @click="emit('move', -1)"
          >
            <span aria-hidden="true">↑</span>
            <span class="visually-hidden">
              {{ $t('common.moveEarlier') }}
              {{ $t('editor.theWayOnTo', {
                place: place + 1,
                scene: toName,
                from: name,
              }) }}
            </span>
          </button>
          <button
            type="button"
            class="mark"
            :disabled="last"
            @click="emit('move', 1)"
          >
            <span aria-hidden="true">↓</span>
            <span class="visually-hidden">
              {{ $t('common.moveLater') }}
              {{ $t('editor.theWayOnTo', {
                place: place + 1,
                scene: toName,
                from: name,
              }) }}
            </span>
          </button>
          <!-- Named the way the three marks beside it are — the act, and
               then the way on it is done to — rather than by a key of its
               own that left the Place out. Two Exits of one Scene leading
               to one Scene made two of these answer to the same words, and
               the Place is the only thing that tells the rows apart: see
               issue #276. -->
          <button type="button" class="mark" @click="duplicateExit(scene, exit)">
            <span aria-hidden="true">⧉</span>
            <span class="visually-hidden">
              {{ $t('common.duplicate') }}
              {{ $t('editor.theWayOnTo', {
                place: place + 1,
                scene: toName,
                from: name,
              }) }}
            </span>
          </button>
          <button
            type="button"
            class="danger mark"
            @click="deleteExit(scene, exit)"
          >
            <span aria-hidden="true">×</span>
            <span class="visually-hidden">
              {{ $t('common.delete') }}
              {{ $t('editor.theWayOnTo', {
                place: place + 1,
                scene: toName,
                from: name,
              }) }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </li>
</template>

<style scoped>
/* A way on's own elements: the rules of the writing whose elements this template
   draws, in the order the writing gives them — see the head of the block in
   `Writing.vue`. */

@import '~/assets/css/folds.css';

.read-mark {
  color: var(--grease);
}

.cutting {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s2);
}

.cutting select {
  inline-size: auto;
  max-inline-size: 100%;
}

.cutting input {
  inline-size: 5rem;
  font-variant-numeric: tabular-nums;
}

.cutting .unit {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.75rem;
}

.written .cutting {
  font-size: 0.8125rem;
}

.ways > ol > li {
  display: grid;
  grid-template-columns: 2ch minmax(0, 1fr);
  gap: var(--s1) var(--s3);
  align-items: start;
}

.ways > ol > li + li {
  margin-block-start: var(--s3);
}

.numbered {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  text-align: end;
  /* On the first line of the row whatever the field's own face makes of it. */
  line-height: 2;
}

.beneath {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--s1) var(--s3);
  min-block-size: 1.5rem;
}

.beneath .conditions {
  flex: 1 1 auto;
  min-inline-size: 0;
}

/* Whether the Reader comes back this way: the label and the answer on one line,
   beside the tests the Exit is offered under rather than under them — two things
   the Author says about the same way on, read along the same edge. It gives way
   before the Conditions do at a narrow width, because the tests are read every
   day and this is answered once. */
.crossing {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--s2);
}

/* Two words on one line: the label is shorter than the answer beside it, and
   broken over two lines it reads as two labels. */
.crossing .eyebrow {
  white-space: nowrap;
}

.beneath .row,
.written .row {
  gap: var(--s1);
}

/* A way on is a row and not a card: where it leads and what the Reader presses
   side by side, and what it is offered under under both. */
.written {
  display: grid;
  grid-template-columns: minmax(8rem, 14rem) minmax(0, 1fr);
  align-items: center;
  gap: var(--s2);
}

.written > .beneath {
  grid-column: 1 / -1;
}

/* How often the way on was taken, under the words the Reader presses: the last
   column, which is that field's in a row and the only one once the row folds,
   and set in as far as the words in the field are. */
.written > .taken {
  grid-column: -2 / -1;
  padding-inline: var(--s2);
}

/* A way out is the Author's own cut, so the Place it is numbered at wears the
   grease pencil where a beat's wears the machined one. */
.ways .numbered {
  color: var(--grease);
}

.arrival {
  display: flex;
  align-items: center;
  gap: var(--s1);
  min-inline-size: 0;
}

/* Where the way on leads: a Scene's name worn as one, in a field that draws its
   frame only under the pointer — the same idiom as the Scene's own name at the
   head of the section — and as wide as the name in it rather than as wide as the
   column, so the row reads "1 → The bar" and not as a slot with a name lying at one
   end of it. */
.arrival select {
  field-sizing: content;
  flex: 0 1 auto;
  inline-size: auto;
  min-inline-size: 4rem;
  max-inline-size: 100%;
  padding: var(--s1) var(--s2);
  border-color: transparent;
  background: none;
  font-size: 0.9375rem;
}

.arrival select:hover,
.arrival select:focus-visible {
  border-color: var(--edge);
}

.said {
  min-inline-size: 0;
}

/* What the Reader presses, typed where it is read: the line the Author wrote on
   the Exit, in a field that draws its frame under the pointer like the name of the
   Scene it leads to. */
.said input {
  padding: var(--s1) var(--s2);
  border-color: transparent;
  background: none;
  font-size: 0.9375rem;
}

.said input:hover,
.said input:focus-visible {
  border-color: var(--edge);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

@media (--phone) {
  .written {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
