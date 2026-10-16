<script setup lang="ts">
/**
 * The Question a Scene asks, and the Flag its answer is held under, where it
 * plays: after the run of Shots and before the ways on are judged. A component of
 * its own, handed its Scene, so that a keystroke into either field draws these two
 * fields again and nothing else of the document: the Flag a Question is held
 * under is offered by every Condition of the Story, and drawn in the document's
 * own template it made each key a render of every Scene. See issue #449.
 *
 * The two fields stand open wherever either holds anything, so what is written
 * stays open on a reload, and otherwise once the Author has asked for them —
 * `docs/adr/0061-what-is-written-stands-open.md`.
 */
const { scene, writing } = defineProps<{
  /** The Scene that asks it. */
  scene: Scene
  /** What the bench calls that Scene, which every control here is named by. */
  name: string
  /** Whether the caret is in it, which is what carries a mark's name. */
  here: boolean
  /** The document's door for what the Author typed, which says a refusal in the Scene. */
  writing: (scene: Scene, written: string, act: () => Promise<unknown>) => Promise<void>
}>()

/** Whether the Author has opened the two fields and not yet written anything in them. */
const asking = ref(false)

const open = computed(() => asking.value || !!scene.question || !!scene.questionFlag)

/** Opens the two fields and puts the caret in the first. */
async function askQuestion() {
  asking.value = true
  await nextTick()
  document.getElementById(`question-${scene.id}`)?.focus()
}

/** The Question and the Flag its answer is held under: one typed write for both. */
function writeQuestion() {
  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { question: scene.question, questionFlag: scene.questionFlag },
  }))
}

/** Empties both and closes the fields, with the caret on the button that reopens them. */
async function removeQuestion() {
  scene.question = ''
  scene.questionFlag = ''
  asking.value = false
  await writeQuestion()
  await nextTick()
  document.getElementById(`ask-${scene.id}`)?.focus()
}
</script>

<template>
  <div class="asks">
    <template v-if="open">
      <p class="asked">
        <label class="eyebrow" :for="`question-${scene.id}`">
          {{ $t('editor.question') }}
          <span class="visually-hidden">{{ name }}</span>
        </label>
        <input
          :id="`question-${scene.id}`"
          v-model="scene.question"
          type="text"
          :maxlength="QUESTION_MAX_LENGTH"
          @change="writeQuestion()"
        >
      </p>
      <p class="asked">
        <label class="eyebrow" :for="`question-flag-${scene.id}`">
          {{ $t('editor.questionFlag') }}
          <span class="visually-hidden">{{ name }}</span>
        </label>
        <input
          :id="`question-flag-${scene.id}`"
          v-model="scene.questionFlag"
          type="text"
          autocomplete="off"
          :maxlength="FLAG_NAME_MAX_LENGTH"
          @change="writeQuestion()"
        >
      </p>
      <button
        type="button"
        class="danger going"
        :data-command="here ? $t('editor.removeQuestion') : undefined"
        @click="removeQuestion()"
      >
        {{ $t('editor.removeQuestion') }}
        <span class="visually-hidden">{{ name }}</span>
      </button>
    </template>
    <button
      v-else
      :id="`ask-${scene.id}`"
      type="button"
      :data-command="here ? $t('editor.askAQuestion') : undefined"
      @click="askQuestion()"
    >
      {{ $t('editor.askAQuestion') }}
      <span class="visually-hidden">{{ name }}</span>
    </button>
  </div>
</template>

<style scoped>
/* The Question's own elements: the rules of the writing whose elements this
   template draws, in the order the writing gives them — see the head of the block
   in `Writing.vue`. */

.going {
  border-color: transparent;
  background: none;
  color: var(--muted);
}

.asks {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s2);
  margin-block: var(--s3);
}

.asked {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  inline-size: 100%;
  margin: 0;
}
</style>
