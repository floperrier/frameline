/**
 * The longest name a Scene may carry, and the longest text a Shot may hold.
 * Shared so the server's rejection and the form's own limit cannot drift apart.
 * A Shot is one beat on screen, not a chapter, so its text is capped well below
 * what Postgres would take.
 */
export const SCENE_NAME_MAX_LENGTH = 200
export const SHOT_TEXT_MAX_LENGTH = 2000

/**
 * The longest text a Cut may carry. A Cut is one line the Reader is offered at
 * the end of a Scene, so it is capped far below a Shot.
 */
export const CUT_TEXT_MAX_LENGTH = 200

/**
 * How far a Scene's node may sit from the graph's top left, in pixels. A bound
 * on both sides of the wire: the server refuses anything beyond it, and dragging
 * stops there, so a Scene cannot be dropped somewhere nobody can scroll to.
 */
export const GRAPH_REACH = 10_000

/**
 * How large a Scene's node is drawn, and how far below the last one a new Scene
 * is placed. Shared because the server does the placing and the graph does the
 * drawing, and the spacing clears the height so a new Scene does not land on top
 * of the controls of the one above it.
 */
export const NODE_WIDTH = 320
export const NODE_HEIGHT = 300
export const NODE_SPACING = NODE_HEIGHT + 40

/**
 * A Story as the Author edits it: Scenes in the order they were written, each a
 * run of Shots and a node in the graph, and the Cuts that join them. A Story
 * with no Scenes has no opening Scene, and neither has one whose opening Scene
 * was deleted.
 */
export type Shot = { id: string, text: string, position: number }
export type Scene = { id: string, name: string, x: number, y: number, shots: Shot[] }
export type Cut = { id: string, fromSceneId: string, toSceneId: string, text: string }
export type StoryInEditor = {
  id: string
  title: string
  openingSceneId: string | null
  scenes: Scene[]
  cuts: Cut[]
}
