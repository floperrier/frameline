<script setup lang="ts">
/**
 * What a beat plays as: every answer a Shot's row chooses from a list, folded
 * under the one line `playsAs` says them in — issue #401 and
 * `docs/adr/0061-what-a-beat-plays-as-is-folded-under-its-words.md`. The Sound
 * picker while there is no Sound, the Cut, the Layout, the Movement, the Effects
 * and how the text arrives: most of what a beat costs to draw, and nothing an
 * Author reads with the fold shut.
 *
 * So a fold draws none of it until it is wanted, and keeps it drawn after while
 * its row stands. It is wanted on the press of its line, which is heard before the
 * browser opens the fold, so the answers are drawn in the same task and the fold
 * never shows open and empty; on the `toggle` that opens it any other way, which
 * is the browser's find in the page; and as the row mounts on a fold the browser
 * opened before the bench's script took over, whose `toggle` was heard by nobody.
 * Nothing in the bench opens one from code: no Command and no Step points inside a
 * fold. See issue #449, and `app/components/ShotRow.vue`, which is the row this
 * stands on.
 */
const { changing, writing } = defineProps<{
  /** The Shot whose fold this is, and the Scene it falls back on wherever it says nothing. */
  shot: Shot
  scene: Scene
  /** What the bench calls that Scene, which every control here is named by. */
  name: string
  /** Its Place in the run, counted from nought. */
  place: number
  /** What every picker of the document is standing on, the document's own record: the fold's is its Shot's entry. */
  picked: Record<string, string>
  /** The document's own two doors, which say a refusal in the Scene the act was in. */
  changing: (scene: Scene, act: () => Promise<unknown>) => Promise<boolean>
  writing: (scene: Scene, written: string, act: () => Promise<unknown>) => Promise<void>
}>()

/** The one Sound the document is listening to, asked of it by the Listen mark. */
const emit = defineEmits<{ listen: [string | undefined] }>()

const { t } = useI18n()

/** Whether the answers are drawn: from the first time the fold is wanted on. */
const wanted = ref(false)
const fold = useTemplateRef<HTMLDetailsElement>('fold')

onMounted(() => {
  if (fold.value?.open) wanted.value = true
})

/**
 * Two of the three gestures a Scene's Sound is given in `Writing.vue`, on a beat:
 * a file of the Author's own or one off the library, both
 * `app/composables/send.ts`'s. The third, taking it away, is on the row, beside
 * the Sound it takes. There is no naming here and no loop — a Shot's Sound strikes with the beat and is gone,
 * and a struck sound weighs 20 KB, which is not worth a column and a `<select>`
 * to save.
 * See `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md`.
 */
function depositShotSound(scene: Scene, shot: Shot, event: Event) {
  const file = depositedFile(event)
  if (!file) return

  return changing(scene, () => depositSoundAt(`/api/shots/${shot.id}/sound`, file))
}

function takeShotSound(scene: Scene, shot: Shot, chosen: string | undefined) {
  if (!chosen?.startsWith('library:')) return

  return changing(scene, () =>
    takeLibrarySoundAt(`/api/shots/${shot.id}/sound`, chosen.slice('library:'.length)))
}


/**
 * What the Shot says about its own Cut, its Movement and how its text arrives,
 * each put on the Shot before the request leaves, as `writeSceneCut` in
 * `Writing.vue` says why.
 */
function writeShotCut(
  scene: Scene,
  shot: Shot,
  body: Partial<Pick<Shot, 'cutAfter' | 'cutOver' | 'cutThrough'>>,
) {
  if (!wholeCut(body)) return
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
}

/** The Layout the Shot says for itself, where *as the Scene says* is the null the column holds. */
function writeShotLayout(scene: Scene, shot: Shot, answer: string) {
  const layout = answer === 'scene' ? null : answer as Layout
  shot.layout = layout

  return writing(scene, shot.id, () =>
    send(`/api/shots/${shot.id}`, { method: 'PATCH', body: { layout } }))
}

function writeShotMovement(scene: Scene, shot: Shot, body: MovementSaid) {
  if (!wholeCut(body)) return
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
}

function writeShotMoves(scene: Scene, shot: Shot, answer: string) {
  if (answer === 'scene') {
    return writeShotMovement(scene, shot, { movementBy: null, movementDirection: null })
  }
  if (answer === 'still') return writeShotMovement(scene, shot, { movementBy: 0 })

  return writeShotMovement(scene, shot, {
    movementDirection: answer as MovementDirection,
    movementBy: shot.movementBy || MOVEMENT_BY_START,
  })
}

function writeShotMovementTakes(scene: Scene, shot: Shot, answer: string) {
  return writeShotMovement(scene, shot, {
    movementOver: answer === 'scene' ? null : answer === 'whole' ? 0 : MOVEMENT_OVER_UNTIMED,
  })
}

/**
 * What a Shot says about one of its Effects. Choosing writes the whole object,
 * as `effectWritten` makes it; *No Effect* writes null.
 */
function writeShotEffect(
  scene: Scene,
  shot: Shot,
  body: Partial<Pick<Shot, EffectSlot>>,
) {
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
}

function writeShotEffectChosen(scene: Scene, shot: Shot, slot: EffectSlot, effect: string) {
  if (!effect) return writeShotEffect(scene, shot, { [slot]: null })

  return writeShotEffect(scene, shot, {
    [slot]: effectWritten(effect, slot.endsWith('Arrives') ? 'arrives' : 'lasts', shot[slot]?.strength ?? 'marked'),
  })
}

function writeShotEffectTime(scene: Scene, shot: Shot, slot: EffectSlot, event: Event) {
  const held = shot[slot]
  const time = held && effectTime(held)
  const written = secondsWritten(event, time ?? null)
  if (!held || written === undefined) return

  return writeShotEffect(scene, shot, {
    [slot]: { ...held, [slot.endsWith('Arrives') ? 'over' : 'every']: written },
  })
}

function writeShotEffectStrength(scene: Scene, shot: Shot, slot: EffectSlot, strength: string) {
  const held = shot[slot]
  if (!held) return

  return writeShotEffect(scene, shot, { [slot]: { ...held, strength: strength as Strength } })
}

/** The three answers a Shot's own row gives, each written as the column holds it. */
function writeShotCutAfter(scene: Scene, shot: Shot, answer: string) {
  return writeShotCut(scene, shot, {
    cutAfter: answer === 'scene' ? null : answer === 'press' ? 0 : A_TIME_HELD,
  })
}

function writeShotCutMade(scene: Scene, shot: Shot, answer: string) {
  const said = answer === 'scene' ? { cutOver: null, cutThrough: null } : cutMade(answer)

  return writeShotCut(scene, shot, said)
}

function writeShotText(scene: Scene, shot: Shot, body: TextSaid) {
  if (!wholeCut(body)) return
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
}

function writeShotTextArrives(scene: Scene, shot: Shot, answer: string) {
  if (answer === 'scene') return writeShotText(scene, shot, { textAfter: null })
  if (answer === 'image') return writeShotText(scene, shot, { textAfter: 0 })

  return writeShotText(scene, shot,
    faded(shot.textOver ?? scene.textOver, { textAfter: A_TEXT_WAIT }))
}

function writeShotTextComes(scene: Scene, shot: Shot, answer: string) {
  // The pace goes with the unit: its field is only there while the Shot has a unit of
  // its own, and a pace left behind would still be the one the Reading plays.
  if (answer === 'scene') {
    return writeShotText(scene, shot, { textBy: null, textPace: null })
  }
  const textBy = answer as TextBy

  return writeShotText(scene, shot, textBy === 'whole'
    ? { textBy }
    : faded(shot.textOver ?? scene.textOver, { textBy }))
}

function writeShotTextAppears(scene: Scene, shot: Shot, answer: string) {
  return writeShotText(scene, shot, {
    textOver: answer === 'scene' ? null : answer === 'once' ? 0 : A_TEXT_FADE,
  })
}

function writeShotTextStays(scene: Scene, shot: Shot, answer: string) {
  return writeShotText(scene, shot, {
    textStays: answer === 'scene' ? null : answer === 'cut' ? 0 : A_TEXT_STAY,
  })
}
</script>

<template>
  <details ref="fold" class="plays" @toggle="wanted = true">
    <summary @click="wanted = true">
      {{ playsAs(shot, scene, t) }}
      <span class="visually-hidden">
        {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
      </span>
    </summary>

    <div v-if="wanted" class="answers">
      <!-- The Sound picker while there is no Sound: a choice from the
           library, or a file to deposit. -->
      <p v-if="!shot.sound" class="struck">
        <label class="visually-hidden" :for="`shot-sound-${shot.id}`">
          {{ $t('editor.soundOfShot', { place: place + 1, scene: name }) }}
        </label>
        <select :id="`shot-sound-${shot.id}`" v-model="picked[shot.id]">
          <option value="">{{ $t('editor.noSoundPicked') }}</option>
          <option v-for="sound in SOUND_LIBRARY" :key="sound.file" :value="`library:${sound.file}`">
            {{ sound.label[$i18n.locale as 'en' | 'fr'] ?? sound.label.en }}
            · {{ $t('editor.soundSeconds', { count: sound.seconds }) }}
          </option>
        </select>
        <!-- Inert on nothing, so disabled on nothing: see the Scene's
             own pair in `Writing.vue`. -->
        <button
          type="button"
          class="mark"
          :disabled="!picked[shot.id]"
          @click="emit('listen', picked[shot.id])"
        >
          {{ $t('editor.listenToSound') }}
          <span class="visually-hidden">
            {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
          </span>
        </button>
        <button
          type="button"
          :disabled="!picked[shot.id]"
          @click="takeShotSound(scene, shot, picked[shot.id])"
        >
          {{ $t('editor.takeSound') }}
          <span class="visually-hidden">
            {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
          </span>
        </button>
        <label class="depositing">
          <span class="visually-hidden">
            {{ $t('editor.pickSoundOfShot', { place: place + 1, scene: name }) }}
          </span>
          <input
            type="file"
            :accept="SOUND_ACCEPT"
            @change="depositShotSound(scene, shot, $event)"
          >
        </label>
      </p>

      <!-- What this beat says about its own Cut, where the Scene has said
           it for the run: both answer *as the Scene says* until the Author
           says otherwise, which is the null the columns hold. A run where
           one Shot is held longer than the others is still read by seeing
           the row that differs: its line says so where the others say
           nothing. -->
      <div class="cut">
        <p class="cutting">
          <label class="eyebrow" :for="`shot-cut-after-${shot.id}`">
            {{ $t('editor.shotIsCut') }}
            <span class="visually-hidden">
              {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
            </span>
          </label>
          <select
            :id="`shot-cut-after-${shot.id}`"
            :value="cutWhen(shot)"
            @change="writeShotCutAfter(
              scene, shot, ($event.target as HTMLSelectElement).value)"
          >
            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
            <option value="press">{{ $t('editor.cutAtThePress') }}</option>
            <option value="clock">{{ $t('editor.cutAfterATime') }}</option>
          </select>
          <template v-if="shot.cutAfter">
            <input
              type="number"
              inputmode="decimal"
              :min="CUT_AFTER_MIN / 1000"
              :max="CUT_AFTER_MAX / 1000"
              step="0.5"
              :value="shot.cutAfter / 1000"
              :aria-label="$t('editor.secondsThisShotStands', {
                place: place + 1,
                scene: name,
              })"
              @change="writeShotCut(scene, shot, {
                cutAfter: secondsWritten($event, shot.cutAfter),
              })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
          </template>
        </p>

        <p class="cutting">
          <label class="eyebrow" :for="`shot-cut-over-${shot.id}`">
            {{ $t('editor.cutIsMade') }}
            <span class="visually-hidden">
              {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
            </span>
          </label>
          <select
            :id="`shot-cut-over-${shot.id}`"
            :value="cutKind(shot)"
            @change="writeShotCutMade(
              scene, shot, ($event.target as HTMLSelectElement).value)"
          >
            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
            <option value="hard">{{ $t('editor.cutHard') }}</option>
            <option value="image">{{ $t('editor.cutThroughImage') }}</option>
            <option value="black">{{ $t('editor.cutThroughBlack') }}</option>
          </select>
          <template v-if="shot.cutOver">
            <input
              type="number"
              inputmode="decimal"
              min="0.1"
              :max="CUT_OVER_MAX / 1000"
              step="0.1"
              :value="shot.cutOver / 1000"
              :aria-label="$t('editor.secondsTheShotsCutTakes', {
                place: place + 1,
                scene: name,
              })"
              @change="writeShotCut(scene, shot, {
                cutOver: secondsWritten($event, shot.cutOver),
              })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
          </template>
        </p>
      </div>

      <!-- What this beat says about its own Layout, answering *as the Scene
           says* until the Author says otherwise, which is the null the
           column holds. -->
      <div class="laid">
        <p class="cutting">
          <label class="eyebrow" :for="`shot-layout-${shot.id}`">
            {{ $t('editor.shotIsLaidOut') }}
            <span class="visually-hidden">
              {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
            </span>
          </label>
          <select
            :id="`shot-layout-${shot.id}`"
            :value="shot.layout ?? 'scene'"
            @change="writeShotLayout(
              scene, shot, ($event.target as HTMLSelectElement).value)"
          >
            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
            <option v-for="layout in LAYOUTS" :key="layout" :value="layout">
              {{ $t(`editor.layout${layout === 'full' ? 'Full' : 'Inset'}`) }}
            </option>
          </select>
        </p>
      </div>

      <!-- What this beat says about how its Image moves, drawn only where the
           Shot has an Image, as the Description is, and its columns survive
           the Image's removal. -->
      <div v-if="shot.image" class="moved">
        <p class="cutting">
          <label class="eyebrow" :for="`shot-movement-${shot.id}`">
            {{ $t('editor.imageMoves') }}
            <span class="visually-hidden">
              {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
            </span>
          </label>
          <select
            :id="`shot-movement-${shot.id}`"
            :value="movementKind(shot)"
            @change="writeShotMoves(
              scene, shot, ($event.target as HTMLSelectElement).value)"
          >
            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
            <option value="still">{{ $t('editor.movementStill') }}</option>
            <option v-for="direction in MOVEMENT_DIRECTIONS" :key="direction" :value="direction">
              {{ $t(`editor.movement${direction[0]!.toUpperCase()}${direction.slice(1)}`) }}
            </option>
          </select>
          <template v-if="shot.movementBy">
            <input
              type="number"
              inputmode="numeric"
              min="1"
              :max="MOVEMENT_BY_MAX"
              step="1"
              :value="shot.movementBy"
              :aria-label="$t('editor.percentThisImageMoves', {
                place: place + 1,
                scene: name,
              })"
              @change="writeShotMovement(scene, shot, {
                movementBy: percentWritten($event, shot.movementBy),
              })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.percentUnit') }}</span>
          </template>
        </p>

        <p v-if="(shot.movementBy ?? scene.movementBy) > 0" class="cutting">
          <label class="eyebrow" :for="`shot-movement-over-${shot.id}`">
            {{ $t('editor.movementTakes') }}
            <span class="visually-hidden">
              {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
            </span>
          </label>
          <select
            :id="`shot-movement-over-${shot.id}`"
            :value="movementTakesKind(shot)"
            @change="writeShotMovementTakes(
              scene, shot, ($event.target as HTMLSelectElement).value)"
          >
            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
            <option value="whole">{{ $t('editor.movementWholeTime') }}</option>
            <option value="time">{{ $t('editor.movementATime') }}</option>
          </select>
          <template v-if="shot.movementOver">
            <input
              type="number"
              inputmode="decimal"
              min="0.1"
              :max="MOVEMENT_OVER_MAX / 1000"
              step="0.1"
              :value="shot.movementOver / 1000"
              :aria-label="$t('editor.secondsThisMovementTakes', {
                place: place + 1,
                scene: name,
              })"
              @change="writeShotMovement(scene, shot, {
                movementOver: secondsWritten($event, shot.movementOver),
              })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
          </template>
        </p>
      </div>

      <!-- What this beat does as its Image and its text arrive and while they
           stay: a run where one Shot shakes is read by the line that says
           so. The Image's two wait for an Image, as the Description does.
           No Command is marked here, because every control is a `<select>`
           or a field — and none may be, folded where the bar cannot see it. -->
      <div class="cut">
        <template v-for="slot in EFFECT_SLOTS" :key="slot.slot">
          <p v-if="!slot.image || shot.image" class="cutting">
            <label
              :id="`shot-${slot.slot}-label-${shot.id}`"
              class="eyebrow"
              :for="`shot-${slot.slot}-${shot.id}`"
            >
              {{ $t(`editor.${slot.slot}`) }}
              <span class="visually-hidden">
                {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
              </span>
            </label>
            <select
              :id="`shot-${slot.slot}-${shot.id}`"
              :value="shot[slot.slot]?.effect ?? ''"
              @change="writeShotEffectChosen(
                scene, shot, slot.slot, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">{{ $t('editor.noEffect') }}</option>
              <option v-for="effect in slot.effects" :key="effect" :value="effect">
                {{ $t(`editor.${EFFECT_LABELS[effect]}`) }}
              </option>
            </select>
            <template v-if="shot[slot.slot]">
              <template v-if="effectTime(shot[slot.slot]!) !== undefined">
                <span :id="`shot-${slot.slot}-seconds-${shot.id}`" class="visually-hidden">
                  {{ $t('editor.effectSeconds') }}
                </span>
                <input
                  type="number"
                  inputmode="decimal"
                  :min="(slot.arrives ? ARRIVES_OVER_MIN : LASTS_EVERY_MIN) / 1000"
                  :max="(slot.arrives ? ARRIVES_OVER_MAX : LASTS_EVERY_MAX) / 1000"
                  step="0.1"
                  :value="effectTime(shot[slot.slot]!)! / 1000"
                  :aria-labelledby="
                    `shot-${slot.slot}-label-${shot.id} shot-${slot.slot}-seconds-${shot.id}`"
                  @change="writeShotEffectTime(scene, shot, slot.slot, $event)"
                >
                <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
              </template>
              <span :id="`shot-${slot.slot}-strength-${shot.id}`" class="visually-hidden">
                {{ $t('editor.effectStrength') }}
              </span>
              <select
                :value="shot[slot.slot]!.strength"
                :aria-labelledby="
                  `shot-${slot.slot}-label-${shot.id} shot-${slot.slot}-strength-${shot.id}`"
                @change="writeShotEffectStrength(
                  scene, shot, slot.slot, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="strength in STRENGTHS" :key="strength" :value="strength">
                  {{ $t(`editor.strength${strength[0]!.toUpperCase()}${strength.slice(1)}`) }}
                </option>
              </select>
            </template>
          </p>
        </template>
      </div>

      <!-- What this beat says about how its own text arrives, drawn on every
           beat that has text, and not as the Description is drawn only
           beside an Image: a beat with no words has nothing to arrive. Each
           answer is *as the Scene says* until the Author says otherwise,
           which is the null the columns hold. Drawn plainly, as the Cut's
           are, because the fold it stands in is already one. -->
      <div v-if="shot.text.trim()" class="cut">
        <p class="cutting">
          <label class="eyebrow" :for="`shot-text-after-${shot.id}`">
            {{ $t('editor.shotTextArrives') }}
            <span class="visually-hidden">
              {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
            </span>
          </label>
          <select
            :id="`shot-text-after-${shot.id}`"
            :value="textArrivesKind(shot)"
            @change="writeShotTextArrives(
              scene, shot, ($event.target as HTMLSelectElement).value)"
          >
            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
            <option value="image">{{ $t('editor.textWithTheImage') }}</option>
            <option value="time">{{ $t('editor.textAfterATime') }}</option>
          </select>
          <template v-if="shot.textAfter">
            <input
              type="number"
              inputmode="decimal"
              min="0.1"
              :max="TEXT_AFTER_MAX / 1000"
              step="0.1"
              :value="shot.textAfter / 1000"
              :aria-label="$t('editor.secondsBeforeThisText', {
                place: place + 1,
                scene: name,
              })"
              @change="writeShotText(scene, shot, {
                textAfter: secondsWritten($event, shot.textAfter),
              })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
          </template>
        </p>

        <p class="cutting">
          <label class="eyebrow" :for="`shot-text-by-${shot.id}`">
            {{ $t('editor.shotTextComes') }}
            <span class="visually-hidden">
              {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
            </span>
          </label>
          <select
            :id="`shot-text-by-${shot.id}`"
            :value="shot.textBy ?? 'scene'"
            @change="writeShotTextComes(
              scene, shot, ($event.target as HTMLSelectElement).value)"
          >
            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
            <option value="whole">{{ $t('editor.textWhole') }}</option>
            <option value="line">{{ $t('editor.textByLine') }}</option>
            <option value="word">{{ $t('editor.textByWord') }}</option>
            <option value="letter">{{ $t('editor.textByLetter') }}</option>
          </select>
          <template v-if="shot.textBy && shot.textBy !== 'whole'">
            <input
              type="number"
              inputmode="decimal"
              min="1"
              :max="TEXT_PACE_MAX"
              step="1"
              :value="shot.textPace ?? scene.textPace"
              :aria-label="$t('editor.paceOfThisText', {
                place: place + 1,
                scene: name,
              })"
              @change="writeShotText(scene, shot, {
                textPace: paceWritten($event),
              })"
            >
            <span class="unit" aria-hidden="true">
              {{ $t('editor.charactersUnit') }}
            </span>
          </template>
        </p>

        <p class="cutting">
          <label class="eyebrow" :for="`shot-text-over-${shot.id}`">
            {{ $t('editor.shotTextAppears') }}
            <span class="visually-hidden">
              {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
            </span>
          </label>
          <select
            :id="`shot-text-over-${shot.id}`"
            :value="textAppearsKind(shot)"
            @change="writeShotTextAppears(
              scene, shot, ($event.target as HTMLSelectElement).value)"
          >
            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
            <option value="once">{{ $t('editor.textAtOnce') }}</option>
            <option value="time">{{ $t('editor.textOverATime') }}</option>
          </select>
          <template v-if="shot.textOver">
            <input
              type="number"
              inputmode="decimal"
              min="0.1"
              :max="TEXT_OVER_MAX / 1000"
              step="0.1"
              :value="shot.textOver / 1000"
              :aria-label="$t('editor.secondsThisTextAppears', {
                place: place + 1,
                scene: name,
              })"
              @change="writeShotText(scene, shot, {
                textOver: secondsWritten($event, shot.textOver),
              })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
          </template>
        </p>

        <p class="cutting">
          <label class="eyebrow" :for="`shot-text-stays-${shot.id}`">
            {{ $t('editor.shotTextStays') }}
            <span class="visually-hidden">
              {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
            </span>
          </label>
          <select
            :id="`shot-text-stays-${shot.id}`"
            :value="textStaysKind(shot)"
            @change="writeShotTextStays(
              scene, shot, ($event.target as HTMLSelectElement).value)"
          >
            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
            <option value="cut">{{ $t('editor.textUntilTheCut') }}</option>
            <option value="time">{{ $t('editor.textForATime') }}</option>
          </select>
          <template v-if="shot.textStays">
            <input
              type="number"
              inputmode="decimal"
              min="0.5"
              :max="TEXT_STAYS_MAX / 1000"
              step="0.5"
              :value="shot.textStays / 1000"
              :aria-label="$t('editor.secondsThisTextStays', {
                place: place + 1,
                scene: name,
              })"
              @change="writeShotText(scene, shot, {
                textStays: secondsWritten($event, shot.textStays),
              })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
          </template>
        </p>
      </div>
    </div>
  </details>
</template>

<style scoped>
/* The fold's own elements: the rules of the writing whose elements this template
   draws, in the order the writing gives them — see the head of the block in
   `Writing.vue`, whose Scene's fold draws the same classes and so holds the same
   rules. */

.plays > summary {
  cursor: pointer;
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

/* On a beat and on a way on, the Cut is read at the size of the row it is
   written on: the Scene's own section is the only place it is read at the size of
   a section. */
.beat .cutting {
  font-size: 0.8125rem;
}

.depositing input {
  font-size: 0.8125rem;
}

.plays > summary {
  color: var(--muted);
  font-size: 0.8125rem;
}

.plays[open] {
  flex-basis: 100%;
}

.plays .answers {
  display: grid;
  gap: var(--s2);
  margin-block-start: var(--s2);
}

.plays .cut,
.plays .laid,
.plays .moved {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s4);
}

.struck {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s2);
  min-inline-size: 0;
}

.struck select {
  max-inline-size: min(100%, 16rem);
  font-size: 0.8125rem;
}
</style>
