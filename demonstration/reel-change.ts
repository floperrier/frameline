/**
 * Reel Change — the short work Frameline exists to carry, written out as the
 * thing it is: Scenes of Shots, joined by Exits, some of them offered only under
 * a Condition. `write.ts` puts it into a Frameline instance through the same API
 * the editor uses, so nothing here reaches the database by a route the Author
 * does not have.
 *
 * A Shot is one image and its text, so the two are written on the same line
 * here. The image is a recipe rather than a photograph — see `work.ts` for what
 * develops it — because the work is shot on what this repository can hold, and a
 * dark room with one lit thing in it is an image either way.
 *
 * Almost every cut in it is made by the Reader's hand and made hard, which is
 * how the whole work read before a Cut could be written. The six that are not
 * are each written where the film already asked for one, and each says so where
 * it stands — see
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`. The last of
 * them is the ending, where the coat goes to black, or the woman without it —
 * see `docs/adr/0053-a-reading-ends-on-its-last-shot.md`.
 *
 * Three texts arrive in their own time, each where the film asks: the opening beam
 * crosses the booth alone and the line fades up onto it, as a title does; the
 * coat's line fades away and leaves the coat alone; and the last words walk — see
 * `docs/adr/0052-a-text-arrives-in-its-own-time.md`.
 *
 * The Images move in four places, each where the film asks: the booth's come
 * closer to what each is of, the strip slides down the gate, the house closes in
 * on the woman in row nine, and the boulevard draws away from her at the last —
 * see `docs/adr/0057-the-image-moves-over-the-time-its-shot-is-on-screen.md`.
 */

import { aligned, bar, formatted, line, run } from '../shared/utils/formatted.ts'
import type { Style } from '../shared/utils/formatted.ts'
import type { Image, Work } from './work.ts'

/* Seeded from the product's own tokens in `app/assets/css/frameline.css` — the
   room an image is looked at in, the paper the light is, the grease pencil, which
   here is the warm lamp of a projector, and the cyan, which here is the sign over
   the door. `DAWN` is the work's own: no interface has ever needed the colour of
   six in the morning. */
const ROOM = '#0b0d0c'
const PAPER = '#e4eae5'
const LAMP = '#e4703a'
const COLD = '#8fa09a'
const SIGN = '#6fd8cb'
const DAWN = '#b8c2c0'

/* How the two texts that are set rather than only written are set: the label
   typed on a reel's can, and the card the day opens on. */
const CAN: Style[] = [
  { type: 'size', attrs: { step: 'small' } },
  { type: 'face', attrs: { face: 'typewriter' } },
]
/* The one lit thing in an empty house, stuttering in the words as it does over the door. */
const SIGN_LIT: Style[] = [{ type: 'lasts', attrs: { effect: 'flicker', strength: 'slight' } }]
const DAYBREAK: Style[] = [
  { type: 'size', attrs: { step: 'largest' } },
  { type: 'face', attrs: { face: 'display' } },
  { type: 'spacing', attrs: { step: 'wide' } },
]

/** The rows of a house, drawn as the backs of seats one behind the other. */
function rows(from: number, count: number, step: number, inset: number) {
  return Array.from({ length: count }, (_, row) => {
    const y = from + row * step
    return `roundrectangle ${inset + row * 30},${y} ${1600 - inset - row * 30},${y + 58} 16,16`
  }).join(' ')
}

/**
 * The boulevard from above at first light, which the work's last beat is shot on
 * whichever Shot plays it: at that size, no coat is told from none.
 */
const BOULEVARD: Image = {
  ground: ['#8d9694', '#404746'],
  glow: [{ colour: DAWN, draw: 'ellipse 800,300 900,400 0,360', blur: 90, opacity: 0.5 }],
  form: [
    // Seen from the booth window: the far kerb, then her, small on the
    // pavement, with the low sun laying her shadow across it.
    { colour: '#39413f', draw: 'rectangle 0,0 1600,150', blur: 10, opacity: 0.6 },
    { colour: '#2b3231', draw: 'polygon 930,540 1420,760 1330,790 880,570', blur: 22, opacity: 0.45 },
    {
      colour: '#121716',
      draw: 'ellipse 894,348 30,40 0,360 '
        + 'polygon 828,548 850,400 892,374 932,374 952,402 966,548',
      blur: 4,
      opacity: 0.95,
    },
  ],
  grain: 0.8,
}

export const REEL_CHANGE: Work = {
  title: 'Reel Change',

  scenes: [
    {
      name: 'The booth',
      // The beam crosses the booth alone, and the text fades up onto it. The setting
      // is the Scene's, so the second Shot of the booth waits and fades up too.
      textAfter: 1500,
      textOver: 1200,
      // The booth is the film's own frame, so it fills the room: a Reader's screen
      // is cut around what each Image is of rather than around its middle, since
      // cropped at the centre a phone would show an empty dark booth.
      layout: 'full',
      // And each Image comes closer to the point it is cropped around, slowly:
      // both Shots are held until the press, so neither has a length for the
      // Movement to span, and each takes the ten seconds a Movement takes there.
      movementBy: 10,
      shots: [
        {
          text: 'The last show has run out. Down in the house the seats fold up on their own, '
            + 'one after another, like something being agreed.',
          description: 'The projector’s beam crossing the dark booth and landing on the screen, '
            + 'with the backs of two rows of seats black across the bottom of the frame.',
          // The house empties while nobody is watching it, and the booth is a
          // later hour by the time there is a reel on the bench. A dissolve is
          // how that hour is written, and it is the first cut of the work so
          // that the hard ones upstairs read as hard.
          cutOver: 1200,
          // The beam lands on the right of the booth.
          cropX: 84,
          cropY: 49,
          // The screen the film has run off, and the lamp still flickering in the
          // beam. Nothing comes before this beat to withhold the flash, and the
          // dissolve above pauses the flicker.
          imageArrives: { effect: 'from-white', over: 2000, strength: 'strong' },
          imageLasts: { effect: 'flicker', strength: 'slight' },
          image: {
            ground: [ROOM, '#050605'],
            glow: [{ colour: LAMP, draw: 'polygon 1060,90 1600,300 1600,790 1000,900', blur: 40 }],
            form: [
              { colour: PAPER, draw: 'polygon 1120,140 1580,300 1580,620 1080,700', blur: 3, opacity: 0.8 },
              // The backs of the seats, between the port window and the screen,
              // and the dark of the house filling the bottom of the image.
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
          // The reel's own label, as it was typed on the can: small, in the
          // typewriter, with the sender's name inked out.
          formatted: formatted(
            line(
              run('200 FT · NO TITLE · FROM ', ...CAN),
              bar(8, 'a name, inked out'),
            ),
            line('On the bench, a reel nobody sent, wound the wrong way round.'),
          ),
          // The reel lies left of the middle of the frame.
          cropX: 38,
          cropY: 52,
          description: 'A film reel lying flat on the bench in cold light, its rings and hub '
            + 'picked out, one warm strip of lamplight down the wall behind it.',
          image: {
            ground: ['#101413', '#040504'],
            glow: [{ colour: COLD, draw: 'circle 600,470 600,190', blur: 60, opacity: 0.35 }],
            form: [
              { colour: '#c9d3cf', draw: 'circle 600,470 600,200', blur: 2, opacity: 0.5 },
              { colour: '#0d100f', draw: 'circle 600,470 600,270', blur: 1 },
              { colour: '#d8e0dc', draw: 'circle 600,470 600,410', blur: 1, opacity: 0.6 },
              { colour: '#0d100f', draw: 'circle 600,470 600,440', blur: 1 },
              { colour: LAMP, draw: 'rectangle 1180,0 1210,900', blur: 8, opacity: 0.5 },
            ],
            grain: 0.8,
          },
        },
      ],
    },

    {
      name: 'The gate',
      sets: { reel: 'threaded' },
      // Threaded film runs whether or not anybody has a hand on it, so this
      // Scene runs too: its beats are cut by the clock and cut hard, at the even
      // pace a projector keeps. The last one answers for itself, and so does the
      // Image alone.
      //
      // The pace is the longest line of the three read whole and no longer: a
      // montage is brisk, and a beat nobody finishes is not brisk, it is lost.
      // `tests/unit/works.spec.ts` holds it to that rather than this comment.
      cutAfter: 5800,
      // And the way on out of it was never a choice — it is the only one, and
      // the Reader has just recognised the house they are standing in. Nought is
      // the Scene flowing into the next without asking, so the way on is never
      // painted and the recognition carries them down the stairs.
      exitsAfter: 0,
      shots: [
        {
          text: 'The film goes into the gate the way a hand goes into a glove.',
          description: 'A strip of film standing bright and vertical in the middle of the frame, '
            + 'sprocket holes down both its edges, the dark bulk of the projector across the left.',
          // The strip slides down as film runs through a gate, over the whole of
          // the Scene's hold, and ends as the clock cuts.
          movementDirection: 'down',
          movementBy: 20,
          image: {
            ground: ['#0d1110', '#040504'],
            glow: [{ colour: PAPER, draw: 'rectangle 700,0 900,900', blur: 70, opacity: 0.55 }],
            form: [
              { colour: '#e8eeea', draw: 'rectangle 720,0 880,900', blur: 2, opacity: 0.9 },
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
          // An Image alone: the film running in the gate, with no words. It is
          // taken in at a glance, so it answers for its own time.
          text: '',
          description: 'The strip of film running through the gate, blurred with speed, '
            + 'its sprocket holes streaking down both edges in the light of the lamp.',
          cutAfter: 2000,
          image: {
            ground: ['#0d1110', '#040504'],
            glow: [{ colour: LAMP, draw: 'rectangle 660,0 940,900', blur: 80, opacity: 0.6 }],
            form: [
              { colour: '#e8eeea', draw: 'rectangle 700,0 900,900', blur: 14, opacity: 0.8 },
              {
                colour: '#0b0d0c',
                draw: Array.from({ length: 9 }, (_, hole) =>
                  `roundrectangle 730,${hole * 100 + 10} 770,${hole * 100 + 80} 6,6 `
                  + `roundrectangle 830,${hole * 100 + 10} 870,${hole * 100 + 80} 6,6`).join(' '),
                blur: 10,
              },
            ],
            grain: 1.2,
          },
        },
        {
          text: 'Two hundred feet of somebody else’s house: rows, a brass rail, '
            + 'a lit sign over a door.',
          // Grain marks this as footage, not the house the Reader stands in later.
          imageLasts: { effect: 'grain', strength: 'marked' },
          description: 'A cinema house projected on the screen: four curved rows of seats, a brass '
            + 'rail along the front, and a lit sign burning above a door at the right.',
          image: {
            ground: ['#121614', '#050706'],
            glow: [
              { colour: LAMP, draw: 'roundrectangle 1220,140 1420,230 8,8', blur: 45 },
              // The house lights, low and behind everything in it.
              { colour: '#8d9c98', draw: 'ellipse 700,500 820,320 0,360', blur: 100, opacity: 0.75 },
            ],
            form: [
              { colour: '#0b0f0e', draw: rows(390, 4, 118, 40), blur: 5, opacity: 0.95 },
              { colour: '#c8a37a', draw: 'roundrectangle 0,690 1600,706 8,8', blur: 5, opacity: 0.75 },
              { colour: '#f0d7b8', draw: 'roundrectangle 1240,160 1400,212 6,6', blur: 2, opacity: 0.85 },
            ],
            grain: 1.1,
          },
        },
        {
          formatted: formatted(line(
            'It is ',
            run('this', { type: 'emphasis' }),
            ' house. Row nine, and a woman looking straight down the lens.',
          )),
          description: 'The same house closer: three rows of seats, and in the middle of them the '
            + 'head and shoulders of a woman facing the lens, cut off by the bottom of the frame.',
          // Nought is *held until the press*. The run has been going by itself
          // for three beats and stops dead on this one, and nothing moves again
          // until the Reader moves it — after which there is nothing to decide.
          cutAfter: 0,
          // The beat the run stops dead on is the one the room should fill, though
          // the gate stays inset around it. The point is on her head.
          layout: 'full',
          cropX: 45,
          cropY: 52,
          // And closes in on her, for twelve seconds unless the Reader presses
          // first: a time of its own, because a Shot held until the press has no
          // length to span.
          movementDirection: 'closer',
          movementBy: 25,
          movementOver: 12000,
          // Attention finding the woman in row nine, in the same grain.
          imageArrives: { effect: 'from-blur', over: 1600, strength: 'marked' },
          imageLasts: { effect: 'grain', strength: 'marked' },
          image: {
            ground: ['#171b19', '#070908'],
            glow: [{ colour: PAPER, draw: 'ellipse 700,700 620,340 0,360', blur: 90, opacity: 0.38 }],
            form: [
              { colour: '#333b38', draw: rows(240, 3, 86, 160), blur: 6, opacity: 0.5 },
              // Head and shoulders in one shape, so no seam runs between them,
              // and low enough that the bottom edge cuts her off.
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
      shots: [
        {
          text: 'The house is warm still, and smells of the dust the lamp burns.',
          description: 'A wedge of projector light falling across the dark house from the top '
            + 'right, with dust drifting through it.',
          image: {
            ground: ['#0e1211', '#040505'],
            glow: [{ colour: LAMP, draw: 'polygon 1520,60 1600,60 700,900 300,900', blur: 55, opacity: 0.7 }],
            form: [
              { colour: '#f3e2cf', draw: 'polygon 1540,80 1580,80 780,880 520,880', blur: 12, opacity: 0.45 },
              {
                colour: PAPER,
                draw: Array.from({ length: 40 }, (_, speck) => {
                  const x = 1450 - speck * 26 - (speck % 5) * 14
                  const y = 120 + speck * 19 + (speck % 7) * 11
                  return `circle ${x},${y} ${x + 2 + (speck % 3)},${y}`
                }).join(' '),
                blur: 2,
                opacity: 0.7,
              },
            ],
            grain: 1.2,
          },
        },
        {
          text: 'Row nine. A coat over the arm of a seat, folded the way somebody folds it '
            + 'who means to come back.',
          description: 'A row of seats in cold half-light, and a coat folded over the arm of one '
            + 'of them.',
          image: {
            ground: ['#0c100f', '#030404'],
            glow: [{ colour: COLD, draw: 'ellipse 760,540 420,240 0,360', blur: 80, opacity: 0.3 }],
            form: [
              { colour: '#1c2220', draw: 'roundrectangle 120,600 1480,900 40,40', blur: 4 },
              { colour: '#3b3430', draw: 'roundrectangle 560,470 1000,760 60,60', blur: 6, opacity: 0.9 },
              { colour: '#6b5d54', draw: 'polygon 600,500 980,490 1020,700 640,720', blur: 10, opacity: 0.7 },
            ],
            grain: 1,
          },
        },
        {
          formatted: formatted(line(
            'Nobody. The screen holds nothing but ',
            run('the green of the sign over the door', ...SIGN_LIT),
            '.',
          )),
          description: 'An empty house: a blank dark screen, and the green glow of the sign over '
            + 'the door, the only lit thing in the frame.',
          image: {
            ground: ['#080a09', '#020303'],
            glow: [{ colour: SIGN, draw: 'roundrectangle 140,180 340,250 8,8', blur: 50, opacity: 0.8 }],
            form: [
              { colour: '#9ff0e5', draw: 'roundrectangle 160,196 320,236 6,6', blur: 3, opacity: 0.7 },
              { colour: '#121716', draw: 'polygon 700,220 1500,340 1500,660 700,740', blur: 4 },
            ],
            grain: 1.3,
          },
        },
      ],
    },

    {
      name: 'The coat',
      shots: [
        {
          text: 'The same coat, over the same arm of the same seat, two hundred feet upstairs.',
          description: 'The same folded coat over the same arm of the same seat, soft and grainy — '
            + 'the coat as the film shows it rather than as the house holds it.',
          image: {
            ground: ['#0d1110', '#040505'],
            glow: [{ colour: LAMP, draw: 'ellipse 820,540 500,300 0,360', blur: 85, opacity: 0.35 }],
            form: [
              { colour: '#5b4f47', draw: 'polygon 520,480 900,470 940,690 560,710', blur: 30, opacity: 0.45 },
              { colour: '#8a7a6e', draw: 'polygon 660,520 1040,510 1080,730 700,750', blur: 6, opacity: 0.75 },
            ],
            grain: 1.5,
          },
        },
        {
          text: 'Whoever shot it stood where the screen stands, and took their time lining it up.',
          description: 'The house seen from where the screen stands, six rows deep, with the small '
            + 'bright square of the booth’s port window high at the back.',
          image: {
            ground: ['#0b0e0d', '#030404'],
            glow: [{ colour: PAPER, draw: 'rectangle 720,150 880,270', blur: 60, opacity: 0.6 }],
            form: [
              { colour: '#e6ece8', draw: 'roundrectangle 740,170 860,250 4,4', blur: 2, opacity: 0.8 },
              { colour: '#333c39', draw: rows(420, 6, 84, 60), blur: 4, opacity: 0.8 },
            ],
            grain: 1.1,
          },
        },
        {
          text: 'The coat is still warm.',
          // The line fades up with the coat, fades away, and leaves the coat alone.
          textStays: 2500,
          textOver: 800,
          description: 'The coat filling the whole frame, close enough that nothing is left of it '
            + 'but its folds and one warm edge of lamplight.',
          // A heart at seventy-five.
          textLasts: { effect: 'pulse', every: 800, strength: 'slight' },
          image: {
            ground: ['#100c0a', '#040303'],
            glow: [{ colour: LAMP, draw: 'ellipse 820,520 300,200 0,360', blur: 110, opacity: 0.75 }],
            form: [
              { colour: '#6b5b50', draw: 'polygon 200,420 1400,380 1500,900 120,900', blur: 40, opacity: 0.5 },
              // The folds of it, close enough that they are all there is to see.
              {
                colour: '#241c18',
                draw: 'polygon 300,470 420,450 900,900 700,900 '
                  + 'polygon 980,440 1080,430 1420,900 1240,900',
                blur: 30,
                opacity: 0.6,
              },
              { colour: '#d09468', draw: 'polygon 640,455 700,450 1010,900 930,900', blur: 26, opacity: 0.4 },
            ],
            grain: 1.8,
          },
        },
      ],
    },

    {
      name: 'Daybreak',
      shots: [
        {
          // A card: every way up arrives at it, and the two through black arrive
          // at a card that is itself the dark.
          formatted: formatted(aligned(
            'centre',
            null,
            run('Six in the morning.', ...DAYBREAK),
          )),
        },
        {
          text: 'The window over the bench gives onto the boulevard, and the boulevard '
            + 'is already grey.',
          description: 'The booth window from inside: a grey rectangle of dawn in four panes, and '
            + 'dark all round it.',
          image: {
            ground: ['#0a0c0c', '#030404'],
            glow: [{ colour: DAWN, draw: 'roundrectangle 480,150 1120,720 6,6', blur: 60, opacity: 0.7 }],
            form: [
              { colour: '#cdd6d4', draw: 'roundrectangle 500,170 1100,700 4,4', blur: 3, opacity: 0.85 },
              { colour: '#0a0c0c', draw: 'rectangle 792,170 808,700 rectangle 500,428 1100,444', blur: 2 },
            ],
            grain: 0.9,
          },
        },
        {
          text: 'Somewhere below it, a coat, going away from the cinema, unhurried.',
          // Played to every Reader who did not take the coat with them, the
          // Reader who never came by it included.
          when: [{ exit: { from: 'The coat', place: 2 }, taken: false }],
          // The words walk, and the last of them arrives five seconds and a half in.
          textBy: 'word',
          textPace: 10,
          textOver: 400,
          // The work ends on this beat or on the next, and a film ends on black:
          // the coat goes to it over three seconds once the Reader presses past
          // it, and the black is where the Reading stops. Said on the Shot rather
          // than on Daybreak, so the cuts between the Scene's other Shots stay hard.
          cutOver: 3000,
          cutThrough: 'black',
          // The Image draws away from her as she walks away from the cinema, over
          // eight seconds, and goes on drawing away as it goes to black. Its point
          // is on her figure, so she is what it draws away from.
          movementDirection: 'away',
          movementBy: 30,
          movementOver: 8000,
          cropX: 56,
          cropY: 50,
          description: 'The boulevard from above at first light: a woman small on the pavement, '
            + 'walking away, her long shadow laid across it.',
          image: BOULEVARD,
        },
        {
          text: 'Somewhere below it, a woman with no coat, going away from the cinema, '
            + 'unhurried.',
          // The same beat, for the Reader who took the coat with them, and told the
          // same way: the words walk, the Image draws away from her, and the work
          // goes to black on it.
          when: [{ exit: { from: 'The coat', place: 2 }, taken: true }],
          textBy: 'word',
          textPace: 10,
          textOver: 400,
          cutOver: 3000,
          cutThrough: 'black',
          movementDirection: 'away',
          movementBy: 30,
          movementOver: 8000,
          cropX: 56,
          cropY: 50,
          description: 'The boulevard from above at first light: a woman with no coat, small on '
            + 'the pavement, walking away, her long shadow laid across it.',
          image: BOULEVARD,
        },
      ],
    },
  ],

  /* The order the Exits are written in is the order the Reader is offered them,
     so the ways on read down the page as they read down the screen.

     The work is read forwards and each Scene is stood in once — see
     `docs/adr/0048-a-scene-is-entered-once.md`. What was a night spent climbing
     between the booth and the house is now one descent: the reel is threaded or
     it is not, and everything after that follows from the answer. */
  exits: [
    { from: 'The booth', to: 'The gate', text: 'Thread it' },
    {
      from: 'The booth',
      to: 'Row nine',
      text: 'Leave it wound and go down into the house',
    },
    { from: 'The gate', to: 'Row nine', text: 'Go down into the house' },
    {
      from: 'Row nine',
      to: 'The coat',
      // Only a Reader who has seen the reel has anything to recognise, so for
      // anyone else this way on is not refused — it is not there.
      text: 'Look at the coat again',
      when: [{ flag: 'reel', is: 'threaded' }],
    },
    {
      from: 'Row nine',
      to: 'Daybreak',
      // A Flag that was never set reads as empty, so this is the way out for the
      // Reader who left the reel on the bench: nothing downstairs means anything
      // to them, and the night simply ends.
      //
      // It ends rather than stops, so it is a passage and not a cut — but a
      // short one, and through the image rather than through black. This way up
      // is never offered beside the two out of The coat, which are offered side
      // by side: what separates it from them has to be legible in the gesture
      // itself, and nine hundred milliseconds of dissolve is a staircase where two
      // seconds of black is a night.
      text: 'Go back up and open the window',
      when: [{ flag: 'reel', is: '' }],
      cutOver: 900,
    },
    {
      from: 'The coat',
      to: 'Daybreak',
      text: 'Go up. Do not run.',
      // The one ellipsis the work makes: the night ends on the stairs and the
      // next thing in the frame is a grey morning. A fade through black is how a
      // sequence is closed, and this is the only sequence here that closes —
      // the Reader coming up the other way crosses the same night in a dissolve,
      // because they have nothing to have left behind.
      cutOver: 2000,
      cutThrough: 'black',
    },
    {
      from: 'The coat',
      to: 'Daybreak',
      text: 'Take the coat with you',
      // Offered second, and through the same black, because the ellipsis closes
      // the sequence whichever answer closes it. Daybreak remembers which: its
      // last beat asks whether this way on was taken.
      cutOver: 2000,
      cutThrough: 'black',
    },
  ],
}
