/**
 * The longest name a Scene may carry, and the longest text a Shot may hold.
 * Shared so the server's rejection and the form's own limit cannot drift apart.
 * A Shot is one beat on screen, not a chapter, so its text is capped well below
 * what Postgres would take.
 */
export const SCENE_NAME_MAX_LENGTH = 200
export const SHOT_TEXT_MAX_LENGTH = 2000

/** A Story as the Author edits it: Scenes in the order they were written, each a run of Shots. */
export type Shot = { id: string, text: string, position: number }
export type Scene = { id: string, name: string, shots: Shot[] }
export type StoryInEditor = { id: string, title: string, scenes: Scene[] }
