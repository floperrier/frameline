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
 * `docs/adr/0075-a-change-costs-what-it-changes.md`.
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

<style scoped src="~/assets/css/writing.css"></style>
