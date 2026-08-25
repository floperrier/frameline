/**
 * The Leaders — the short Story an Author is given, written to be taken apart
 * rather than read. Three Scenes, named plainly, so the graph reads like a
 * diagram of the product; and the whole language already working, so an Author
 * meets a Flag set on entry, a Condition on a Shot testing it, and a Condition
 * counting visits before being asked to write any of them.
 *
 * There is one Leader per Language and nothing translates between them, which is
 * why they sit here beside *Reel Change* rather than in `i18n/locales`: a Leader
 * is a work, not chrome — see
 * `docs/adr/0018-a-leader-exists-once-per-language.md`. The two agree in
 * structure and share nothing else: their Scene names, their texts and even the
 * names of their Flags are each language's own.
 *
 * The stills are the one thing they do share, because a diagram of the product
 * carries no words. They are the WebP files in `stills/`, developed once by
 * `stills.ts` from the recipes below, because a Shot may only carry a JPEG, a PNG
 * or a WebP and the runtime the product deploys to has no ImageMagick on it.
 */

import type { Still, Work } from './work.ts'

/* The bench's own tokens, from `app/assets/css/frameline.css`: a Leader's stills
   are diagrams of the product, so they are lit like the room the product is
   read in. */
const BENCH = '#141917'
const DARK = '#0a0c0b'
const STEEL = '#1e2523'
const EDGE = '#38443f'
const PAPER = '#e4eae5'
const MUTED = '#8fa09a'
const LIGHT = '#6fd8cb'
const GREASE = '#e4703a'

/** One thing of the diagram, drawn the way the bench draws a panel. */
function panel(x: number, y: number, width: number, height: number) {
  return `roundrectangle ${x},${y} ${x + width},${y + height} 10,10`
}

/** The lit strip down a panel's leading edge, which is how the bench says what a thing is. */
function strip(x: number, y: number, height: number) {
  return `roundrectangle ${x},${y} ${x + 10},${y + height} 4,4`
}

/** Two bars inside a panel, standing for the text a Shot carries. */
function lines(x: number, y: number, width: number) {
  return `${panel(x, y, width, 16)} ${panel(x, y + 40, Math.round(width * 0.6), 16)}`
}

/** The two ways on of `a-cut`, leaving one edge and landing on different Scenes. */
const WAYS_ON = 'polygon 500,436 1060,206 1060,226 500,456 '
  + 'polygon 500,444 1060,674 1060,694 500,464'

/**
 * The stills a Leader shows, one per name a Shot may ask for. Five diagrams and
 * no photographs: a run of Shots, the ways on at the end of a Scene, a Flag on
 * its Scene, a test standing in front of a beat, and what one Reading holds.
 */
export const LEADER_STILLS: Record<string, Still> = {
  'a-scene': {
    ground: [BENCH, DARK],
    glow: [{ colour: LIGHT, draw: panel(140, 330, 380, 240), blur: 70, opacity: 0.4 }],
    form: [
      {
        colour: STEEL,
        draw: `${panel(140, 330, 380, 240)} ${panel(610, 330, 380, 240)} ${panel(1080, 330, 380, 240)}`,
        blur: 2,
      },
      { colour: LIGHT, draw: strip(140, 330, 240), blur: 2, opacity: 0.9 },
      { colour: EDGE, draw: `${strip(610, 330, 240)} ${strip(1080, 330, 240)}`, blur: 2 },
      {
        colour: PAPER,
        draw: `${lines(190, 400, 280)} ${lines(660, 400, 280)} ${lines(1130, 400, 280)}`,
        blur: 2,
        opacity: 0.45,
      },
    ],
    grain: 0.6,
  },

  'a-cut': {
    ground: [BENCH, DARK],
    glow: [{ colour: GREASE, draw: WAYS_ON, blur: 40, opacity: 0.55 }],
    form: [
      {
        colour: STEEL,
        draw: `${panel(120, 330, 380, 240)} ${panel(1060, 100, 380, 240)} ${panel(1060, 560, 380, 240)}`,
        blur: 2,
      },
      {
        colour: GREASE,
        draw: WAYS_ON,
        blur: 3,
        opacity: 0.85,
      },
      {
        colour: EDGE,
        draw: `${strip(120, 330, 240)} ${strip(1060, 100, 240)} ${strip(1060, 560, 240)}`,
        blur: 2,
      },
      { colour: PAPER, draw: lines(170, 400, 280), blur: 2, opacity: 0.45 },
      {
        colour: PAPER,
        draw: `${lines(1110, 170, 280)} ${lines(1110, 630, 280)}`,
        blur: 2,
        opacity: 0.25,
      },
    ],
    grain: 0.7,
  },

  'a-flag': {
    ground: [BENCH, DARK],
    glow: [{ colour: GREASE, draw: panel(830, 420, 300, 70), blur: 50, opacity: 0.45 }],
    form: [
      { colour: STEEL, draw: panel(400, 260, 800, 380), blur: 2 },
      { colour: LIGHT, draw: strip(400, 260, 380), blur: 2, opacity: 0.9 },
      // A Flag as it is written on its Scene: a name, then what it holds.
      { colour: MUTED, draw: panel(470, 420, 280, 70), blur: 2, opacity: 0.7 },
      { colour: GREASE, draw: panel(830, 420, 300, 70), blur: 2, opacity: 0.9 },
      { colour: PAPER, draw: lines(470, 320, 400), blur: 2, opacity: 0.4 },
    ],
    grain: 0.7,
  },

  'a-condition': {
    ground: [BENCH, DARK],
    glow: [{ colour: LIGHT, draw: 'polygon 800,300 980,450 800,600 620,450', blur: 60, opacity: 0.45 }],
    form: [
      { colour: STEEL, draw: panel(80, 330, 380, 240), blur: 2 },
      { colour: LIGHT, draw: strip(80, 330, 240), blur: 2, opacity: 0.9 },
      { colour: PAPER, draw: lines(130, 400, 280), blur: 2, opacity: 0.45 },
      // The test itself, and behind it the beat that does not play.
      { colour: LIGHT, draw: 'polygon 800,320 960,450 800,580 640,450', blur: 3, opacity: 0.75 },
      { colour: STEEL, draw: panel(1140, 330, 380, 240), blur: 2, opacity: 0.7 },
      { colour: PAPER, draw: lines(1190, 400, 280), blur: 2, opacity: 0.12 },
    ],
    grain: 0.8,
  },

  'a-state': {
    ground: [BENCH, DARK],
    glow: [{ colour: LIGHT, draw: panel(120, 250, 640, 120), blur: 55, opacity: 0.3 }],
    form: [
      // The Flags one Reading holds, one to a plate.
      {
        colour: STEEL,
        draw: `${panel(120, 250, 640, 120)} ${panel(120, 400, 640, 120)} ${panel(120, 550, 640, 120)}`,
        blur: 2,
      },
      { colour: GREASE, draw: `${strip(120, 250, 120)} ${strip(120, 400, 120)}`, blur: 2, opacity: 0.9 },
      { colour: EDGE, draw: strip(120, 550, 120), blur: 2 },
      {
        colour: PAPER,
        draw: `${lines(190, 285, 420)} ${lines(190, 435, 420)} ${lines(190, 585, 420)}`,
        blur: 2,
        opacity: 0.4,
      },
      // And the times it has entered each Scene, counted off to the side.
      {
        colour: LIGHT,
        draw: Array.from({ length: 3 }, (_, count) =>
          `circle ${960 + count * 130},310 ${1000 + count * 130},310`).join(' '),
        blur: 4,
        opacity: 0.7,
      },
      {
        colour: MUTED,
        draw: Array.from({ length: 3 }, (_, count) =>
          `circle ${960 + count * 130},610 ${1000 + count * 130},610`).join(' '),
        blur: 4,
        opacity: 0.35,
      },
    ],
    grain: 0.8,
  },
}

/**
 * The English Leader. Its Scenes sit where they read as a diagram: the opening
 * Scene on the left, and the two it leads to stacked to the right of it.
 */
const ENGLISH: Work = {
  title: 'A Story in three Scenes',
  language: 'en',
  opening: 'Where a Story starts',

  scenes: [
    {
      name: 'Where a Story starts',
      at: [60, 380],
      shots: [
        {
          text: 'This is a Shot: one Still and its text, shown to you as a single beat. '
            + 'The Scene you are in is a run of them, and it runs in the same order for '
            + 'every Reader.',
          description: 'Three panels in a row on a dark bench, the first of them lit: a Scene '
            + 'as the run of Shots it is.',
          still: 'a-scene',
        },
        {
          text: 'This Shot has no Still. A Shot may be text alone, or a Still alone — what '
            + 'it may not be is neither.',
        },
      ],
    },

    {
      name: 'What a Cut offers',
      at: [520, 100],
      sets: { cut: 'taken' },
      shots: [
        {
          text: 'You took a Cut to get here. A Cut is a way on, offered at the end of a '
            + 'Scene, and a Story branches nowhere else.',
          description: 'One panel on the left, and two lines leaving its edge for two panels '
            + 'on the right.',
          still: 'a-cut',
        },
        {
          text: 'Entering this Scene set a Flag: cut = taken. A Scene sets its Flags on every '
            + 'entry, and they stay in this Reading’s State until something sets them again.',
          description: 'A panel with a plate laid across it, a pale name beside a lit value.',
          still: 'a-flag',
        },
      ],
    },

    {
      name: 'What a Condition tests',
      at: [520, 700],
      shots: [
        {
          text: 'A Condition is one flat test on State, carried by a Shot or by a Cut. Where '
            + 'it does not hold, the Shot is not played and the Cut is not offered: nothing '
            + 'is refused, it is simply not there. Nothing here is precious — change it, '
            + 'break it, delete it.',
          description: 'Two panels with a lit lozenge standing between them, the far one '
            + 'dimmed almost out of the frame.',
          still: 'a-condition',
        },
        {
          text: 'This beat is playing because you came through the second Scene and it set '
            + 'that Flag. Arrive here another way and this Shot is not in the run at all.',
          description: 'Plates stacked on the left and two rows of dots on the right: the '
            + 'Flags one Reading holds, and the times it has entered a Scene.',
          still: 'a-state',
          when: [{ flag: 'cut', is: 'taken' }],
        },
      ],
    },
  ],

  cuts: [
    { from: 'Where a Story starts', to: 'What a Cut offers', text: 'Take the Cut' },
    {
      from: 'Where a Story starts',
      to: 'What a Condition tests',
      text: 'Skip ahead — you have stood here before',
      // A Condition needs no Flag at all: this way on is not there the first time
      // through, and is there on every pass after it.
      when: [{ scene: 'Where a Story starts', visits: 'at least', times: 2 }],
    },
    {
      from: 'What a Cut offers',
      to: 'What a Condition tests',
      text: 'Go on to the Conditions',
    },
    { from: 'What a Cut offers', to: 'Where a Story starts', text: 'Go back to the first Scene' },
    {
      from: 'What a Condition tests',
      to: 'Where a Story starts',
      text: 'Read it again from the start',
    },
  ],
}

/** The French Leader. The same three Scenes; not a line of the English one. */
const FRENCH: Work = {
  title: 'Un Récit en trois Scènes',
  language: 'fr',
  opening: 'Là où un Récit commence',

  scenes: [
    {
      name: 'Là où un Récit commence',
      at: [60, 380],
      shots: [
        {
          text: 'Ceci est un Plan : un Photogramme et son texte, montrés d’un seul temps. '
            + 'La Scène où vous êtes en est une suite, et elle se déroule dans le même ordre '
            + 'pour chaque Lecteur.',
          description: 'Trois panneaux alignés sur un établi sombre, le premier éclairé : une '
            + 'Scène comme la suite de Plans qu’elle est.',
          still: 'a-scene',
        },
        {
          text: 'Ce Plan n’a pas de Photogramme. Un Plan peut n’être que du texte, ou qu’une '
            + 'image — ce qu’il ne peut pas être, c’est ni l’un ni l’autre.',
        },
      ],
    },

    {
      name: 'Ce qu’offre une Coupe',
      at: [520, 100],
      sets: { coupe: 'prise' },
      shots: [
        {
          text: 'Vous avez pris une Coupe pour venir ici. Une Coupe est une issue, offerte à '
            + 'la fin d’une Scène, et un Récit ne bifurque nulle part ailleurs.',
          description: 'Un panneau à gauche, et deux traits qui quittent son bord vers deux '
            + 'panneaux à droite.',
          still: 'a-cut',
        },
        {
          text: 'Entrer dans cette Scène a posé un Marqueur : coupe = prise. Une Scène pose '
            + 'ses Marqueurs à chaque entrée, et ils restent dans l’État de cette Lecture '
            + 'jusqu’à ce que quelque chose les repose.',
          description: 'Un panneau traversé d’une plaque, un nom pâle à côté d’une valeur '
            + 'éclairée.',
          still: 'a-flag',
        },
      ],
    },

    {
      name: 'Ce que teste une Condition',
      at: [520, 700],
      shots: [
        {
          text: 'Une Condition est un test plat sur l’État, porté par un Plan ou par une '
            + 'Coupe. Là où elle ne tient pas, le Plan n’est pas joué et la Coupe n’est pas '
            + 'offerte : rien n’est refusé, la chose n’est simplement pas là. Rien ici n’est '
            + 'précieux — modifiez, cassez, supprimez.',
          description: 'Deux panneaux séparés par un losange éclairé, le plus loin presque '
            + 'éteint dans le cadre.',
          still: 'a-condition',
        },
        {
          text: 'Ce temps se joue parce que vous êtes passé par la deuxième Scène et qu’elle '
            + 'a posé ce Marqueur. Arrivez ici autrement et ce Plan n’est pas dans la suite '
            + 'du tout.',
          description: 'Des plaques empilées à gauche et deux rangées de points à droite : '
            + 'les Marqueurs qu’une Lecture porte, et le nombre d’entrées dans une Scène.',
          still: 'a-state',
          when: [{ flag: 'coupe', is: 'prise' }],
        },
      ],
    },
  ],

  cuts: [
    { from: 'Là où un Récit commence', to: 'Ce qu’offre une Coupe', text: 'Prendre la Coupe' },
    {
      from: 'Là où un Récit commence',
      to: 'Ce que teste une Condition',
      text: 'Passer devant — vous êtes déjà venu ici',
      // Une Condition n’a besoin d’aucun Marqueur : cette issue n’est pas là au
      // premier passage, et elle est là à tous les suivants.
      when: [{ scene: 'Là où un Récit commence', visits: 'at least', times: 2 }],
    },
    {
      from: 'Ce qu’offre une Coupe',
      to: 'Ce que teste une Condition',
      text: 'Continuer vers les Conditions',
    },
    {
      from: 'Ce qu’offre une Coupe',
      to: 'Là où un Récit commence',
      text: 'Revenir à la première Scène',
    },
    {
      from: 'Ce que teste une Condition',
      to: 'Là où un Récit commence',
      text: 'Relire depuis le début',
    },
  ],
}

/** The Leaders, by the Language each is written in. */
export const LEADERS = { en: ENGLISH, fr: FRENCH }

export type LeaderLanguage = keyof typeof LEADERS

export const LEADER_LANGUAGES = Object.keys(LEADERS) as LeaderLanguage[]

/**
 * Where a Leader's still is committed. The bytes rather than the recipe, because
 * a Still may only be a JPEG, a PNG or a WebP read from its own first bytes, and
 * the runtime this deploys to has no ImageMagick to develop one on: they are
 * developed once by `stills.ts` and checked in.
 */
export function stillPath(name: string) {
  return new URL(`stills/${name}.webp`, import.meta.url)
}
