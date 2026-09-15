<script setup lang="ts">
/**
 * Where a way on out of one Scene may land: every Scene of the Story bar that one
 * and the ones it already reaches. What the field offers, not what it refuses —
 * the server allows both slips, and a name typed in full is written on purpose.
 *
 * Drawn twice on every Scene's section: as the options of the field on a way on's
 * own row that says where it leads, and as the list the field at the foot of the
 * Scene offers a name from. So a Story of forty Scenes carries eighty of these
 * lists of forty, and the document is re-rendered on every character typed into a
 * beat — which is the quadratic redraw this whole surface is arranged to avoid.
 * A component whose props have not changed is not re-rendered at all, and a
 * keystroke changes none of these, so a keystroke rebuilds none of them.
 */
const { scenes, exits, from, led, names } = defineProps<{
  /** Every Scene of the Story, which is what a way on chooses among. */
  scenes: Scene[]
  /** Every Exit of the Story, which is what says what this Scene already reaches. */
  exits: Exit[]
  /** The Scene the way on leaves. */
  from: string
  /**
   * The Scene a way on already arrives at, which belongs in its own field although
   * a new way on may not land there.
   */
  led?: string
  /**
   * What the bench calls each Scene, `namesOnTheBench`, where the field chooses a
   * Scene by id and shows it under that name: two Scenes an Author called the same
   * are told apart there the way every other control tells them apart. Left out
   * where the list is one a name is typed from — there an option is the Author's
   * own name, because a name typed there is the name the Scene is written under.
   * See `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`.
   */
  names?: Map<string, string>
}>()

const landings = computed(() => {
  const landing = scenesAExitMayLandOn(scenes, exits, from)

  return scenes.filter(other => landing.has(other.id) || other.id === led)
})
</script>

<template>
  <template v-for="landing in landings" :key="landing.id">
    <option v-if="names" :value="landing.id">{{ names.get(landing.id) }}</option>
    <option v-else :value="landing.name" />
  </template>
</template>
