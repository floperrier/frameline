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
const { scenes, exits, from, led, byName = false } = defineProps<{
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
  /** The list a name is typed from, where an option is a name rather than an id. */
  byName?: boolean
}>()

const landings = computed(() => {
  const landing = scenesAExitMayLandOn(scenes, exits, from)

  return scenes.filter(other => landing.has(other.id) || other.id === led)
})
</script>

<template>
  <template v-for="landing in landings" :key="landing.id">
    <option v-if="byName" :value="landing.name" />
    <option v-else :value="landing.id">{{ landing.name }}</option>
  </template>
</template>
