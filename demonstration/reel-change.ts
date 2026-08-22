/**
 * Reel Change — the short work Frameline exists to carry, written out as the
 * thing it is: Scenes of Shots, joined by Cuts, some of them offered only under
 * a Condition. `write.ts` puts it into a Frameline instance through the same API
 * the editor uses, so nothing here reaches the database by a route the Author
 * does not have.
 *
 * A Shot is one still and its text, so the two are written on the same line
 * here. The still is a recipe rather than a photograph — see `write.ts` for what
 * develops it — because the work is shot on what this repository can hold, and
 * a dark room with one lit thing in it is a frame either way.
 */

/**
 * A shape the light does something to: the colour it comes out, the ImageMagick
 * primitive that draws it, how far the light spreads past its edge, and how much
 * of the frame's brightness it is allowed.
 */
export type Lit = { colour: string, draw: string, blur?: number, of?: number }

/**
 * One still, as the four things that make it: the ground it is graded from top
 * to bottom, the shapes lit from behind it, the shapes the light lands on, and
 * how much grain the stock carries.
 */
export type Still = {
  ground: [string, string]
  glow?: Lit[]
  form?: Lit[]
  grain?: number
}

export type Shot = { text: string, still: Still }

/** What a Cut is offered under, with a Scene named rather than identified. */
export type When =
  | { flag: string, is: string }
  | { scene: string, visits: 'at least' | 'fewer than', times: number }

export type Work = {
  title: string
  scenes: { name: string, at: [number, number], sets?: Record<string, string>, shots: Shot[] }[]
  cuts: { from: string, to: string, text: string, when?: When }[]
}

/* The palette is the product's own, from `app/assets/css/frameline.css`: the
   room the frames are looked at in, the paper the light is, and the grease
   pencil, which here is the warm lamp of a projector. */
const ROOM = '#0b0d0c'
const PAPER = '#e4eae5'
const LAMP = '#e4703a'
const COLD = '#8fa09a'
const DAWN = '#b8c2c0'

/** The rows of a house, drawn as the backs of seats one behind the other. */
function rows(from: number, count: number, step: number, inset: number) {
  return Array.from({ length: count }, (_, row) => {
    const y = from + row * step
    return `roundrectangle ${inset + row * 30},${y} ${1600 - inset - row * 30},${y + 58} 16,16`
  }).join(' ')
}

export const REEL_CHANGE: Work = {
  title: 'Reel Change',

  scenes: [
    {
      name: 'The booth',
      at: [60, 460],
      shots: [
        {
          text: 'The last show has run out. Down in the house the seats fold up on their own, '
            + 'one after another, like something being agreed.',
          still: {
            ground: [ROOM, '#050605'],
            glow: [{ colour: LAMP, draw: 'polygon 1060,90 1600,300 1600,790 1000,900', blur: 40 }],
            form: [
              { colour: PAPER, draw: 'polygon 1120,140 1580,300 1580,620 1080,700', blur: 3, of: 0.8 },
              // The backs of the seats, between the port window and the screen,
              // and the dark of the house filling the bottom of the frame.
              {
                colour: '#060807',
                draw: 'roundrectangle 0,660 1600,730 24,24 roundrectangle 0,770 1600,900 24,24',
                blur: 6,
              },
            ],
            grain: 0.7,
          },
        },
        {
          text: 'On the bench, a reel nobody sent, wound the wrong way round.',
          still: {
            ground: ['#101413', '#040504'],
            glow: [{ colour: COLD, draw: 'circle 600,470 600,190', blur: 60, of: 0.35 }],
            form: [
              { colour: '#c9d3cf', draw: 'circle 600,470 600,200', blur: 2, of: 0.5 },
              { colour: '#0d100f', draw: 'circle 600,470 600,270', blur: 1 },
              { colour: '#d8e0dc', draw: 'circle 600,470 600,410', blur: 1, of: 0.6 },
              { colour: '#0d100f', draw: 'circle 600,470 600,440', blur: 1 },
              { colour: LAMP, draw: 'rectangle 1180,0 1210,900', blur: 8, of: 0.5 },
            ],
            grain: 0.8,
          },
        },
      ],
    },

    {
      name: 'The gate',
      at: [520, 40],
      sets: { reel: 'threaded' },
      shots: [
        {
          text: 'The film goes into the gate the way a hand goes into a glove.',
          still: {
            ground: ['#0d1110', '#040504'],
            glow: [{ colour: PAPER, draw: 'rectangle 700,0 900,900', blur: 70, of: 0.55 }],
            form: [
              { colour: '#e8eeea', draw: 'rectangle 720,0 880,900', blur: 2, of: 0.9 },
              {
                colour: '#0b0d0c',
                draw: Array.from({ length: 9 }, (_, hole) =>
                  `roundrectangle 736,${hole * 100 + 22} 764,${hole * 100 + 62} 6,6 `
                  + `roundrectangle 836,${hole * 100 + 22} 864,${hole * 100 + 62} 6,6`).join(' '),
                blur: 1,
              },
              { colour: '#1a1f1d', draw: 'rectangle 0,380 720,470', blur: 3 },
            ],
            grain: 0.9,
          },
        },
        {
          text: 'Two hundred feet of somebody else’s house: rows, a brass rail, '
            + 'a lit sign over a door.',
          still: {
            ground: ['#121614', '#050706'],
            glow: [
              { colour: LAMP, draw: 'roundrectangle 1220,140 1420,230 8,8', blur: 45 },
              // The house lights, low and behind everything in it.
              { colour: '#8d9c98', draw: 'ellipse 700,500 820,320 0,360', blur: 100, of: 0.75 },
            ],
            form: [
              { colour: '#0b0f0e', draw: rows(390, 4, 118, 40), blur: 5, of: 0.95 },
              { colour: '#c8a37a', draw: 'roundrectangle 0,690 1600,706 8,8', blur: 5, of: 0.75 },
              { colour: '#f0d7b8', draw: 'roundrectangle 1240,160 1400,212 6,6', blur: 2, of: 0.85 },
            ],
            grain: 1.1,
          },
        },
        {
          text: 'It is this house. Row nine, and a woman looking straight down the lens.',
          still: {
            ground: ['#171b19', '#070908'],
            glow: [{ colour: PAPER, draw: 'ellipse 700,700 620,340 0,360', blur: 90, of: 0.38 }],
            form: [
              { colour: '#333b38', draw: rows(240, 3, 86, 160), blur: 6, of: 0.5 },
              // Head and shoulders in one shape, so no seam runs between them,
              // and low enough in the frame that the bottom edge cuts her off.
              {
                colour: '#080a09',
                draw: 'ellipse 720,470 100,124 0,360 '
                  + 'polygon 470,900 570,640 660,570 780,570 870,640 970,900',
                blur: 7,
              },
              { colour: '#050706', draw: 'roundrectangle 0,860 1600,900 20,20', blur: 8 },
            ],
            grain: 1.4,
          },
        },
      ],
    },

    {
      name: 'Row nine',
      at: [520, 900],
      sets: { house: 'walked' },
      shots: [
        {
          text: 'The house is warm still, and smells of the dust the lamp burns.',
          still: {
            ground: ['#0e1211', '#040505'],
            glow: [{ colour: LAMP, draw: 'polygon 1520,60 1600,60 700,900 300,900', blur: 55, of: 0.7 }],
            form: [
              { colour: '#f3e2cf', draw: 'polygon 1540,80 1580,80 780,880 520,880', blur: 12, of: 0.45 },
              {
                colour: PAPER,
                draw: Array.from({ length: 40 }, (_, speck) => {
                  const x = 1450 - speck * 26 - (speck % 5) * 14
                  const y = 120 + speck * 19 + (speck % 7) * 11
                  return `circle ${x},${y} ${x + 2 + (speck % 3)},${y}`
                }).join(' '),
                blur: 2,
                of: 0.7,
              },
            ],
            grain: 1.2,
          },
        },
        {
          text: 'Row nine. A coat over the arm of a seat, folded the way somebody folds it '
            + 'who means to come back.',
          still: {
            ground: ['#0c100f', '#030404'],
            glow: [{ colour: COLD, draw: 'ellipse 760,540 420,240 0,360', blur: 80, of: 0.3 }],
            form: [
              { colour: '#1c2220', draw: 'roundrectangle 120,600 1480,900 40,40', blur: 4 },
              { colour: '#3b3430', draw: 'roundrectangle 560,470 1000,760 60,60', blur: 6, of: 0.9 },
              { colour: '#6b5d54', draw: 'polygon 600,500 980,490 1020,700 640,720', blur: 10, of: 0.7 },
            ],
            grain: 1,
          },
        },
        {
          text: 'Nobody. The screen holds nothing but the green of the sign over the door.',
          still: {
            ground: ['#080a09', '#020303'],
            glow: [{ colour: '#6fd8cb', draw: 'roundrectangle 140,180 340,250 8,8', blur: 50, of: 0.8 }],
            form: [
              { colour: '#9ff0e5', draw: 'roundrectangle 160,196 320,236 6,6', blur: 3, of: 0.7 },
              { colour: '#121716', draw: 'polygon 700,220 1500,340 1500,660 700,740', blur: 4 },
            ],
            grain: 1.3,
          },
        },
      ],
    },

    {
      name: 'The coat',
      at: [980, 900],
      shots: [
        {
          text: 'The same coat, over the same arm of the same seat, two hundred feet upstairs.',
          still: {
            ground: ['#0d1110', '#040505'],
            glow: [{ colour: LAMP, draw: 'ellipse 820,540 500,300 0,360', blur: 85, of: 0.35 }],
            form: [
              { colour: '#5b4f47', draw: 'polygon 520,480 900,470 940,690 560,710', blur: 30, of: 0.45 },
              { colour: '#8a7a6e', draw: 'polygon 660,520 1040,510 1080,730 700,750', blur: 6, of: 0.75 },
            ],
            grain: 1.5,
          },
        },
        {
          text: 'Whoever shot it stood where the screen stands, and had time to get the frame right.',
          still: {
            ground: ['#0b0e0d', '#030404'],
            glow: [{ colour: PAPER, draw: 'rectangle 720,150 880,270', blur: 60, of: 0.6 }],
            form: [
              { colour: '#e6ece8', draw: 'roundrectangle 740,170 860,250 4,4', blur: 2, of: 0.8 },
              { colour: '#333c39', draw: rows(420, 6, 84, 60), blur: 4, of: 0.8 },
            ],
            grain: 1.1,
          },
        },
        {
          text: 'The coat is still warm.',
          still: {
            ground: ['#100c0a', '#040303'],
            glow: [{ colour: LAMP, draw: 'ellipse 820,520 300,200 0,360', blur: 110, of: 0.75 }],
            form: [
              { colour: '#6b5b50', draw: 'polygon 200,420 1400,380 1500,900 120,900', blur: 40, of: 0.5 },
              // The folds of it, close enough that they are all there is to see.
              {
                colour: '#241c18',
                draw: 'polygon 300,470 420,450 900,900 700,900 '
                  + 'polygon 980,440 1080,430 1420,900 1240,900',
                blur: 30,
                of: 0.6,
              },
              { colour: '#d09468', draw: 'polygon 640,455 700,450 1010,900 930,900', blur: 26, of: 0.4 },
            ],
            grain: 1.8,
          },
        },
      ],
    },

    {
      name: 'Daybreak',
      at: [980, 400],
      shots: [
        {
          text: 'The window over the bench gives onto the boulevard, and the boulevard '
            + 'is already grey.',
          still: {
            ground: ['#0a0c0c', '#030404'],
            glow: [{ colour: DAWN, draw: 'roundrectangle 480,150 1120,720 6,6', blur: 60, of: 0.7 }],
            form: [
              { colour: '#cdd6d4', draw: 'roundrectangle 500,170 1100,700 4,4', blur: 3, of: 0.85 },
              { colour: '#0a0c0c', draw: 'rectangle 792,170 808,700 rectangle 500,428 1100,444', blur: 2 },
            ],
            grain: 0.9,
          },
        },
        {
          text: 'Somewhere below it, a coat, going away from the cinema, unhurried.',
          still: {
            ground: ['#8d9694', '#404746'],
            glow: [{ colour: DAWN, draw: 'ellipse 800,300 900,400 0,360', blur: 90, of: 0.5 }],
            form: [
              // Seen from the booth window: the far kerb, then her, small on the
              // pavement, with the low sun laying her shadow across it.
              { colour: '#39413f', draw: 'rectangle 0,0 1600,150', blur: 10, of: 0.6 },
              { colour: '#2b3231', draw: 'polygon 930,540 1420,760 1330,790 880,570', blur: 22, of: 0.45 },
              {
                colour: '#121716',
                draw: 'ellipse 894,348 30,40 0,360 '
                  + 'polygon 828,548 850,400 892,374 932,374 952,402 966,548',
                blur: 4,
                of: 0.95,
              },
            ],
            grain: 0.8,
          },
        },
      ],
    },
  ],

  /* The order the Cuts are written in is the order the Reader is offered them,
     so the ways on read down the page as they read down the screen. */
  cuts: [
    {
      from: 'The booth',
      to: 'The gate',
      text: 'Thread it',
      // A Flag that was never set reads as empty, so this is the way on being
      // offered exactly once: the Scene it leads to sets `reel`.
      when: { flag: 'reel', is: '' },
    },
    {
      from: 'The booth',
      to: 'Row nine',
      text: 'Go down into the house',
      when: { flag: 'house', is: '' },
    },
    {
      from: 'The booth',
      to: 'Daybreak',
      text: 'Open the window onto the boulevard',
      // The third time the Reader stands in the booth, whatever they did with the
      // first two, the only way on left is out.
      when: { scene: 'The booth', visits: 'at least', times: 3 },
    },
    { from: 'The gate', to: 'The booth', text: 'Kill the lamp and go back up' },
    { from: 'Row nine', to: 'The booth', text: 'Climb back to the booth' },
    {
      from: 'Row nine',
      to: 'The coat',
      text: 'Look at the coat again',
      // Only a Reader who has seen the reel has anything to recognise, so for
      // anyone else this way on is not refused — it is not there.
      when: { flag: 'reel', is: 'threaded' },
    },
    { from: 'The coat', to: 'The booth', text: 'Go up. Do not run.' },
  ],
}
