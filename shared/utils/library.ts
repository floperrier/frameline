/**
 * The library of Sounds shipped with the product: a folder of files served by
 * the CDN, and this, which is what the picker reads. Picking one fetches it and
 * deposits it through the same PUT any upload goes through — the same validation,
 * the same sniffing, the same cap, and no server path of its own. The bytes are
 * copied into the row at the moment of the pick, so a published Story depends on
 * no file the product might later withdraw; that is what
 * `docs/adr/0005-a-shots-image-lives-in-its-row.md` protects.
 *
 * **CC0 only.** Not CC-BY: an attribution redistributed inside every published
 * Story of every Author is an obligation the product cannot keep on their behalf.
 * Every file here is developed by `demonstration/sounds.ts` from a recipe held
 * beside it, the way the Samples' images are developed by ImageMagick — which is
 * what makes the licence true by construction rather than by a claim somebody has
 * to be trusted about. A curated CC0 recording drops into the folder and the
 * manifest the day one is wanted; nothing else changes.
 *
 * The labels are here rather than in `i18n/locales`, because a library entry is
 * data about a file and not a string the interface says — the same reason a
 * Sample is a work and lives beside the other works.
 */
export type LibrarySound = {
  /** The file itself, which is also what the picker keys on. */
  file: string
  /** What it is called, in each Locale the interface is read in. */
  label: { en: string, fr: string }
  /** How long it runs, which is what tells a bed from a strike at a glance. */
  seconds: number
  provenance: string
  licence: 'CC0'
}

/** Where the browser fetches one, which is the folder the CDN serves. */
export function libraryUrl(file: string) {
  return `/sounds/${file}`
}

const WRITTEN_HERE = 'Developed for Frameline from the recipe in demonstration/sounds.ts'

export const SOUND_LIBRARY: LibrarySound[] = [
  {
    file: 'rain.m4a',
    label: { en: 'Rain', fr: 'Pluie' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'heavy-rain.m4a',
    label: { en: 'Heavy rain', fr: 'Pluie battante' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'wind.m4a',
    label: { en: 'Wind', fr: 'Vent' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'sea.m4a',
    label: { en: 'Sea', fr: 'Mer' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'room-tone.m4a',
    label: { en: 'Room tone', fr: 'Souffle de pièce' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'traffic.m4a',
    label: { en: 'Traffic', fr: 'Circulation' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'crowd.m4a',
    label: { en: 'Crowd', fr: 'Foule' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'fire.m4a',
    label: { en: 'Fire', fr: 'Feu' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'forest-night.m4a',
    label: { en: 'Forest at night', fr: 'Forêt la nuit' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'machine-hum.m4a',
    label: { en: 'Machine hum', fr: 'Ronronnement de machine' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'rails.m4a',
    label: { en: 'Rails', fr: 'Rails' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'water.m4a',
    label: { en: 'Running water', fr: 'Eau courante' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'wires.m4a',
    label: { en: 'Wind in the wires', fr: 'Vent dans les fils' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'projector.m4a',
    label: { en: 'Projector', fr: 'Projecteur' },
    seconds: 20,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'door-close.m4a',
    label: { en: 'A door closing', fr: 'Une porte qui se ferme' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'door-slam.m4a',
    label: { en: 'A door slamming', fr: 'Une porte claquée' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'latch.m4a',
    label: { en: 'A latch', fr: 'Un loquet' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'switch.m4a',
    label: { en: 'A switch', fr: 'Un interrupteur' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'glass.m4a',
    label: { en: 'A glass set down', fr: 'Un verre posé' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'bottle.m4a',
    label: { en: 'A bottle on wood', fr: 'Une bouteille sur le bois' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'footstep.m4a',
    label: { en: 'A footstep', fr: 'Un pas' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'knock.m4a',
    label: { en: 'A knock', fr: 'Un coup frappé' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'phone.m4a',
    label: { en: 'A telephone, once', fr: 'Un téléphone, une fois' },
    seconds: 2,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'clapper.m4a',
    label: { en: 'A clapperboard', fr: 'Un clap' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'shutter.m4a',
    label: { en: 'A shutter', fr: 'Un déclencheur' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'thunder.m4a',
    label: { en: 'Thunder', fr: 'Le tonnerre' },
    seconds: 3,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'paper.m4a',
    label: { en: 'Paper', fr: 'Du papier' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'coin.m4a',
    label: { en: 'A coin', fr: 'Une pièce' },
    seconds: 1,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'engine.m4a',
    label: { en: 'An engine starting', fr: 'Un moteur qui démarre' },
    seconds: 2,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
  {
    file: 'bell.m4a',
    label: { en: 'A bell', fr: 'Une cloche' },
    seconds: 3,
    provenance: WRITTEN_HERE,
    licence: 'CC0',
  },
]
