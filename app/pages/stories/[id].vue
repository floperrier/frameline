<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const id = useRoute().params.id as string
// `useFetch` would forward the session cookie itself, but it cannot be given a
// URL that is not a literal (see `send`), so the cookie is passed on by hand —
// without it the render on the server reaches the API as nobody.
const headers = useRequestHeaders(['cookie'])
const { data: story, refresh } = await useAsyncData(
  `story-${id}`,
  () => send(`/api/stories/${id}`, { headers }) as Promise<StoryInEditor>,
)
const { problem, change } = useEditing(refresh)

const newSceneName = ref('')

function createScene() {
  const name = newSceneName.value
  return change(async () => {
    await send(`/api/stories/${id}/scenes`, { method: 'POST', body: { name } })
    newSceneName.value = ''
  })
}

function deleteScene(scene: Scene) {
  if (!confirm(`Delete “${scene.name}” and its ${scene.shots.length} Shots?`)) return
  return change(() => send(`/api/scenes/${scene.id}`, { method: 'DELETE' }))
}

function addShot(scene: Scene) {
  return change(() => send(`/api/scenes/${scene.id}/shots`, { method: 'POST' }))
}

function writeShot(shot: Shot) {
  return change(() => send(`/api/shots/${shot.id}`, { method: 'PATCH', body: { text: shot.text } }))
}

function moveShot(shot: Shot, direction: 'earlier' | 'later') {
  return change(() => send(`/api/shots/${shot.id}/move`, { method: 'POST', body: { direction } }))
}

function deleteShot(shot: Shot) {
  return change(() => send(`/api/shots/${shot.id}`, { method: 'DELETE' }))
}
</script>

<template>
  <main>
    <header>
      <NuxtLink to="/stories">All Stories</NuxtLink>
      <h1>{{ story?.title }}</h1>
    </header>

    <form @submit.prevent="createScene">
      <label for="new-scene-name">Name of a new Scene</label>
      <input id="new-scene-name" v-model="newSceneName" required :maxlength="SCENE_NAME_MAX_LENGTH">
      <button type="submit">Create Scene</button>
    </form>

    <p v-if="problem" role="alert">{{ problem }}</p>

    <p v-if="!story?.scenes.length">No Scenes yet.</p>
    <section v-for="scene in story?.scenes" :key="scene.id">
      <h2>{{ scene.name }}</h2>
      <button type="button" @click="deleteScene(scene)">
        Delete Scene <span class="visually-hidden">{{ scene.name }}</span>
      </button>

      <!-- Numbered from one for the Author, though the Scene counts from zero. -->
      <ol>
        <li v-for="(shot, place) in scene.shots" :key="shot.id">
          <label :for="`shot-${shot.id}`">Shot {{ place + 1 }}</label>
          <textarea
            :id="`shot-${shot.id}`"
            v-model="shot.text"
            :maxlength="SHOT_TEXT_MAX_LENGTH"
            @change="writeShot(shot)"
          />
          <button type="button" :disabled="place === 0" @click="moveShot(shot, 'earlier')">
            Move earlier <span class="visually-hidden">Shot {{ place + 1 }}</span>
          </button>
          <button
            type="button"
            :disabled="place === scene.shots.length - 1"
            @click="moveShot(shot, 'later')"
          >
            Move later <span class="visually-hidden">Shot {{ place + 1 }}</span>
          </button>
          <button type="button" @click="deleteShot(shot)">
            Delete <span class="visually-hidden">Shot {{ place + 1 }}</span>
          </button>
        </li>
      </ol>

      <button type="button" @click="addShot(scene)">
        Add Shot <span class="visually-hidden">to {{ scene.name }}</span>
      </button>
    </section>
  </main>
</template>
