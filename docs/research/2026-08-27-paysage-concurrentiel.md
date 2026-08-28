# Paysage concurrentiel des éditeurs de récits interactifs

Recherche menée le 2026-08-27, en sources primaires uniquement :
documentation officielle, manuels d'éditeur, spécifications de format, code
source des dépôts officiels, registres npm et API GitHub. Aucune source
secondaire n'est citée comme fait ; là où seules des sources secondaires
existaient, l'outil est renvoyé à la section « Trous ».

Le vocabulaire de Frameline suit le glossaire de `CONTEXT.md` — Récit, Scène,
Plan, Photogramme, Description, Rang, Coupe, Graphe, Scène d'ouverture,
Condition, Amorce, Repère, État, Marqueur, Lecture, Position, Auteur, Lecteur,
Aperçu, Publier, Langue, Langue de l'interface. Chaque concurrent est décrit
dans son propre vocabulaire.

## 1. Tableau comparatif

Colonnes : unité de branchement / modèle d'État / expressivité des conditions /
médias natifs / format d'export / extensibilité / validation et tests.

| Outil | Unité de branchement | État | Conditions | Médias natifs | Export | Extensibilité | Validation / tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Twine 2 (éditeur) | passage | aucun (délégué au format) | aucune | **aucun** | HTML autonome, Twee 3, archive | formats d'histoire, JS/CSS par histoire | compteur de « broken links » dans Details |
| Harlowe 3 | passage | `$var` histoire, `_var` temporaire, tours | `(if:)` `(else-if:)` `(unless:)` `(cond:)` | **aucun** (HTML/CSS bruts) | via Twine | macros auteur `(macro:)`, pas d'API JS publique | Debug Mode, `(assert-exists:)`, Replays |
| SugarCube 2 | passage | moments d'historique + `$`/`_` | `<<if>>` `<<elseif>>` `<<for>>` | markup `[img[]]`, passages média base64 | via Twine ou Tweego | `Macro.add`, `<<widget>>`, Config/UI/Save API | Test Mode, Debug bar, panneau Watch |
| Chapbook | passage | section `vars:` + localStorage continu | modifiers `[if]` `[unless]` `[else]` | `{embed image:}` **alt obligatoire** | via Twine | `engine.extend`, inserts et modifiers | Backstage : History, State, Snapshots |
| ink | knot / stitch / weave | globales `VAR`, `temp`, `LIST`, visit counts | `{cond}` sur choix et blocs, `and`/`or` | **aucun** (tags `#` seulement) | `.json` compilé, inkjs, ink-unity | `EXTERNAL` + `BindExternalFunction` | pas d'outil de test officiel documenté |
| Yarn Spinner | node | `<<declare>>` `<<set>>`, 3 types, global | `<<if>>` `<<elseif>>`, `<<if>>` en fin d'option | **aucun** | compilé, string tables CSV | commandes et fonctions personnalisées | options indisponibles livrées quand même |
| ChoiceScript | `*label` / scene | `*set`, stats | `*if` `*selectable_if` | **aucun** | app Choice of Games | fermé | **`quicktest` + `randomtest`** avec couverture |
| Ren'Py | `label` + `menu` | store Python, snapshot par statement | `if` Python | **langage d'images complet** | PC, mobile, **web WebAssembly** | Python complet | **`lint`**, `testcase` scriptés, Skein absent |
| Naninovel | `.nani` script + `@goto` | Game/Global/Settings, JSON `.nson` | `if:` sur commande | acteurs à apparences, atlas dicé | build Unity, WebGL | commandes C# custom | page tests non vérifiée |
| Fungus | Block dans un Flowchart | variables private/public/global | commandes de flux | portraits `Sprite` + stage | build Unity | commandes custom, Lua | aucun |
| Inform 7 | règles, scènes, monde simulé | monde simulé complet | langage naturel | `Figure ... is the file "x.png"` (Glulx) | Glulx / blorb | extensions | **`Test me with "..."`**, Skein rejoué |
| Squiffy | section `[[ ]]` / passage `[ ]` | attributs + localStorage | attributs | aucun | HTML/JS autonome | JavaScript | aucun |
| articy:draft X | Flow Fragment, Dialogue Fragment, Hub | variables globales, 3 types, Variable Sets | **Condition sur pin d'entrée** | section Assets, preview image | 16 formats, XML + XSD | Macro Dev Kit, API .NET | Simulation Mode, expression fausse surlignée |
| Arcweave | element, branch, jumper | Global / Board, 4 types | `if`/`elseif`/`else` sans `endif` | covers image, vidéo, YouTube | JSON, XLSX, PDF, Markdown jouable | export JSON, REST read-only | debugger Play Mode, aucun linter |
| Chat Mapper | dialogue node dans une conversation | Lua 5.1, `SimStatus` par nœud | `ConditionsString` Lua | un fichier audio **par segment** | XML, JSON, XLSX, lecteur HTML | Exporter Development Kit | **le mieux outillé** : nœuds inatteignables, variables non définies |
| Dialogue Designer | node dans un arbre | 3 types, **locales au fichier** | **chaîne opaque** non évaluée | **aucun** | un JSON | aucune | quasi rien |
| Rivet | node dans un graph | `DataValue` typés | If/Else data-driven | types `image`, `audio` | YAML `.rivet-project` | plugins npm, MCP | **Trivet** : suites de tests, N itérations |
| Charisma.ai | nœud de Story Graph | Memory 5 types, Tags | Gates (nœuds) | Media Library, TTS 1000+ voix | **aucun export** | Function nodes JS sandbox | aucune ; analytics post-publication |
| H5P Branching Scenario | `content[]` + `nextContentId` | **aucune variable**, score seul | **aucune** | image d'accueil, `startScreenAltText` | `.h5p`, iframe | `semantics.json` | aucune |
| **Frameline** | **Scène** (jamais le Plan) | Marqueurs plats + visites, recalculé | **plates, conjonction seule** | **le Photogramme est premier** | — | — | Aperçu avec Conditions non tenues expliquées |

Lecture du tableau : Frameline est le seul de la liste dont l'unité de
branchement est plus grosse que l'unité d'affichage (ADR 0001), et le seul dont
l'État n'est jamais stocké mais recalculé depuis la Position.

## 2. Fiches par outil

### Twine 2 et ses formats

**Twine 2 (l'éditeur).** Source : `github.com/klembot/twinejs`, doc mdbook
officielle `docs/en/src`. L'éditeur ne fournit ni état, ni conditions, ni
médias : tout cela appartient au format d'histoire. Il crée automatiquement le
passage cible d'un lien après une pause de frappe, propose l'autocomplétion, et
**réécrit les liens au renommage** — sauf ce qui est écrit en code de format.
La page `limitations/multimedia.md` est explicite : « Twine doesn't have a way
to store images » ; il faut une URL. Détection d'erreurs : *Story → Details*
affiche « Links » et « Broken links » ; aucune détection de passage orphelin
n'est documentée. Accessibilité : la préférence *Use Enhanced Editors* est
signalée comme pouvant « cause problems with assistive technology like screen
readers » et la doc recommande de la désactiver.

**Spécifications IFTF.** `github.com/iftechfoundation/twine-specs`. Twee 3
(v3.0.2) : en-tête `:: Nom [tags] {"position":"600,400"}`, métadonnées limitées
à `position` et `size`, passage `StoryData` portant un JSON dont `ifid` est
obligatoire. Sortie HTML (v1.0.2) : `<tw-storydata>` racine,
`<tw-passagedata pid name tags position size>` dont le corps est un unique nœud
texte échappé. Format d'histoire : un `format.js` contenant un seul appel
`window.storyFormat({...})`, dont `version` et `source` sont requis, `source`
portant les placeholders `{{STORY_NAME}}` et `{{STORY_DATA}}`.

**Harlowe 3.3.8.** Manuel `twine2.neocities.org`. `$var` d'histoire, `_var`
temporaire à portée de passage ou de hook, sensibles à la casse. Conditions par
changers attachés à un hook : `(if: $x is 2)[…]`. Le point saillant pour nous
est le **modèle de tours** : mots-clés `visits`, `turns`, `exits`, `pos`, et un
Debug Mode dont le menu **Turns** permet de sauter en avant et en arrière dans
la partie « as if navigating the web browser's history ». Sauvegarde par
`(save-game: "Slot A")` / `(load-game:)` / `(saved-games:)`. Aucune syntaxe
d'image native. Aucune API JavaScript publique documentée.

**SugarCube 2.37.** `motoslave.net/sugarcube/2/docs`. C'est le format le plus
explicite sur l'État et il mérite d'être lu en entier avant toute décision de
moteur. L'historique est une suite de **moments créés uniquement lors d'une
navigation de passage** ; chaque moment capture le passage actif et toutes les
variables `$`. Conséquence documentée : sauvegarder après `<<set $var to 2>>`
dans un `<<link>>` enregistre encore l'ancienne valeur, car « the new moment
has not been created yet ». `Config.history.maxStates` plafonne les moments
vivants. `State.random()` remplace `Math.random()` afin d'être **capturé dans
l'historique**, et `State.prng.init([seed])` fournit un PRNG semé — c'est la
seule mention de déterminisme reproductible de toute la famille Twine. La Save
API (refondue en 2.37.0) définit un objet
`{date, desc, id, metadata, state, type, version}` et quatre types
`Auto|Base64|Disk|Slot`. Médias : markup `[img[home.png]]` et **passages
média** taggés `Twine.image` dont le contenu est une data URI base64, avec
l'avertissement d'un surcoût d'environ 33 %. i18n : objet global
`l10nStrings`, chaînes de remplacement `{NAME}`.

**Chapbook.** `klembot.github.io/chapbook/guide/en/`. Deux traits nous
concernent directement. D'abord l'**alt obligatoire** :
`{embed image: 'cave.jpeg', alt: 'Cave entrance'}`, avec chaîne vide explicite
pour une image décorative, et des conseils rédactionnels dans la doc — c'est
exactement la position que Frameline tient avec la Description. Ensuite la
**sauvegarde automatique silencieuse** en localStorage à chaque navigation vers
un nouveau passage, justifiée par les onglets déchargés sur mobile et par la
volonté de décourager le *save scumming* : pas de slots, pas de rollback.
`config.random.seed` permet un aléatoire reproductible. Backstage fournit des
**Snapshots nommés** restaurant l'état complet, passage courant inclus.

**Tweego 2.1.1.** `motoslave.net/tweego/docs`. Compilateur Twee → HTML.
Les fichiers médias déposés dans l'arborescence **deviennent des passages
média** nommés d'après le nom de base du fichier. Options `-d` (décompiler),
`-a` (archiver), `-t` (mode test), `-w` (watch).

### ink, Yarn Spinner, ChoiceScript

**ink.** `github.com/inkle/ink/Documentation`. Unités : knot `=== nom ===`,
stitch `= nom`, adressage `-> knot.stitch`. Le **weave** ramène les branches par
des gathers `-` sans créer de knot, avec la garantie que « the flow is
guaranteed to start at the top and 'fall' to the bottom ». Choix `*` once-only
et `+` sticky ; **fallback choice** sans texte, choisi automatiquement si rien
d'autre n'est disponible. Point remarquable pour Frameline : « a knot or stitch
used in this way is actually an integer variable » — le compteur de visites
*est* une variable, donc `* {seen_clue > 3}` s'écrit sans syntaxe dédiée.
`LIST` donne des ensembles à états multiples. `TURNS_SINCE(-> knot)` renvoie -1
si jamais vu. `SEED_RANDOM()` existe.

Moteur (`RunningYourInk.md`) : sauvegarde par
`string savedJson = story.state.ToJson();` et restauration par
`story.state.LoadJson(savedJson);` — c'est un **instantané d'état sérialisé**,
pas un rejeu. Visites : `story.state.VisitCountAtPathString("yourKnot")`.
Choix : `story.currentChoices` puis `story.ChooseChoiceIndex(i)`. Saut :
`story.ChoosePathString("myKnotName.theStitchWithin")`, avec l'avertissement
qu'on « can't reference gather or choice labels this way ». `EXTERNAL
playSound(name)` côté ink, `BindExternalFunction("playSound", …)` côté hôte, et
un drapeau `lookaheadSafe` : les actions veulent `false`, les fonctions pures
`true` — c'est la trace d'un moteur qui **exécute en avance** pour savoir quels
choix sont valides, exactement le piège que le forecasting d'articy documente
lui aussi. Aucune notion d'image : les tags `#` sont le seul canal de
métadonnées vers le jeu.

**Yarn Spinner.** `docs.yarnspinner.dev`. Unité : le node. Variables `$nom`,
**trois types seulement** (nombre, chaîne, booléen), déclaration recommandée
par `<<declare $gold = 42>>` avec commentaires `///`, une variable « cannot be
empty » et ne change jamais de type. Conditions : bloc
`<<if>>`/`<<elseif>>`/`<<else>>`/`<<endif>>`, l'expression devant produire un
booléen — « `<<if 1>>` isn't allowed, but `<<if 1 == 1>>` is ». Le trait le plus
intéressant pour notre moteur est le comportement des **options
conditionnelles** : la condition se pose en fin de ligne d'option, et si elle
est fausse l'option est marquée *unavailable* mais **livrée quand même au
jeu** — « Yarn Spinner always delivers *every* option in an option group to the
game ». C'est le contraire du choix de Frameline, où une Coupe dont une
Condition échoue est invisible plutôt que refusée. Yarn choisit de laisser
l'hôte décider s'il grise ou masque ; nous décidons pour lui. Fonctions
intégrées : `visited(node)` booléen, `visited_count(node)` entier, `random()`,
`random_range(a,b)`, `dice(sides)`, `min`, `max`, `round`, `int`, `decimal`, et
`format_invariant(n)` — cette dernière parce que `{$gold}` peut produire
« 4,51 » en allemand et casser une commande, ce qui est un rappel utile pour un
produit bilingue. Les fonctions personnalisées « should be pure functions ».

**ChoiceScript.** `github.com/dfabulich/choicescript`. C'est le seul outil de
tout le corpus dont les **tests automatisés de récit** sont un produit livré, et
c'est le plus transposable à Frameline. Deux exécutables à la racine du dépôt :

- `quicktest.js` — trois lignes, qui chargent `autotest.js` dans le contexte
  courant. Le parcours est systématique plutôt qu'aléatoire.
- `randomtest.js` — dont l'en-tête donne l'usage littéral :
  `// usage: randomtest num=10000 game=mygame seed=0 delay=false trial=false`.
  Les paramètres lus par `parseArgs` sont `num`, `game`, **`seed`**, `delay`,
  `trial`, `showText`, `showCoverage`, `showChoices`, `avoidUsedOptions`,
  `recordBalance`, `outputFile`, `allowBetaBug`, `requireFeedbackCommand`.
  Défauts : `iterations = 10`, `randomSeed = 0`, `showCoverage = true`,
  `avoidUsedOptions = true`.

Le mécanisme de couverture est lisible dans le source : une table `coverage`
indexée par nom de scène puis par numéro de ligne, incrémentée à l'exécution,
avec une fonction `rollbackLineCoverage(lineNum)` qui **décrémente** — le
moteur revient donc en arrière et doit défaire son propre comptage. Le rapport
final imprime, pour chaque scène et chaque ligne,
`sceneName + " " + (sceneCoverage[j] || 0) + ": " + sceneLines[j]`, c'est-à-dire
**le nombre de passages sur chaque ligne du récit, ligne source à l'appui**.
Une ligne à zéro est du texte que personne ne peut atteindre. La question posée
à l'utilisateur en mode interactif est littéralement : « After the test, show
how many times each line was used? ». `avoidUsedOptions = true` par défaut
signifie que le marcheur aléatoire préfère les options qu'il n'a pas encore
prises — c'est une heuristique de couverture, pas un tirage uniforme.

### Ren'Py, Naninovel, Fungus

**Ren'Py 8.5.4.** `renpy.org/doc/html`. C'est la référence du domaine sur les
images, et Frameline est le seul autre outil du corpus à mettre l'image au
premier rang. Déclaration : `image eileen happy = "eileen_happy.png"`, ou
simple dépôt dans `game/images/` (extension retirée, nom mis en minuscules),
les déclarations explicites primant. Le nom d'image est un **tag plus des
attributs** : dans `mary beach night happy`, le tag est `mary` ; `show` choisit
l'image du même tag contenant tous les attributs demandés et partageant le plus
d'attributs avec ce qui est déjà affiché, une ambiguïté levant une exception.
Retrait d'attribut par `show susan -happy`. Le suffixe `@N` — `eileen
happy@2.png` — déclare un asset **suréchantillonné** : un fichier 3840×2160
occupe une empreinte logique de 1920×1080. C'est le mécanisme HiDPI natif, et
c'est une idée directement transposable au Photogramme. La doc note que les
`hide` sont « rarely necessary » : un changement d'expression est un simple
`show` qui remplace l'image de même tag.

Transitions : `with` s'applique **après** l'exécution des `show`/`hide`, entre
l'état de fin de l'interaction précédente et l'état courant, et déclenche une
interaction interruptible. `with None` est une interaction abrégée qui
**réinitialise le point de départ** de la transition ; le sucre `show X at left
with dissolve` se développe en `with None` puis `show` puis `dissolve`.
Prédéfinies : `dissolve`, `fade`, `pixellate`, `move`, `ease`, `vpunch`,
`irisin`, `wipeleft`, `pushleft`… avec des constructeurs paramétrables
`Dissolve(time)`, `ImageDissolve(image, time, ramplen=8)`, `CropMove`,
`AlphaDissolve`, `MultipleTransition`.

Sauvegarde et rollback (`save_load_rollback.html`) : le modèle mental donné par
la doc est « rollback can be thought of as saving the game at the start of each
statement that interacts with the user, and loading those saves when the user
rolls back ». C'est de la **restauration d'instantané**, à la granularité de la
statement, et la doc en tire elle-même le piège : une boucle `while` Python qui
appelle `narrator(...)` plusieurs fois dans une seule statement revient au début
de la statement. `NoRollback` et `SlottedNoRollback` permettent d'exclure des
objets ; `MultiRevertable` d'en inclure. Seules les variables **modifiées**
depuis le début de la partie sont sauvegardées, et « variables set using the
default statement will always be saved ».

Accessibilité (`self_voicing.html`) : le **self-voicing** parle l'interface
sans lecteur d'écran, via SAPI, macOS ou les API TTS d'Android, iOS et
Chrome OS. La propriété de style `alt` est **traduisible** et prioritaire sur
le texte d'une `Action` ; les balises `{alt}…{/alt}` marquent ce qui est
entendu mais non vu, `{noalt}…{/noalt}` l'inverse — l'exemple de la doc est
`p "My name is {noalt}Cholmondeley{/noalt}{alt}Chumley{/alt}."`. Une note dit
que `renpy.alt()` est « for accessibility purposes, and should not be used for
gameplay purposes ».

Tests (`testcases.html`) : des `testcase` scriptés, paramétrables
(`parameter (x, y, z) = [(1,2,3), (2,3,5)]`), avec `advance`, `click`,
`run Jump("chapter_3")`, `assert`, `repeat`, `until`, `screenshot`, exécutables
en CLI par `./renpy.sh <basedir> test [<testcase>]`. Le détail décisif : la
sélection d'un élément **par son texte s'appuie sur le texte `alt`**, donc
l'accessibilité sert directement les tests. Lint est décrit sommairement dans
`developer_tools.html` : il « checks the game for potential errors and
misoptimisations », mais la doc prévient que ce n'est « not a substitute for
thorough testing » ; la page `lint.html` n'existe pas et la liste exacte des
contrôles n'est pas vérifiable.

Web (`web.html`) : build WebAssembly, pas de threads donc pas de préchargement
d'images en arrière-plan, et un fichier `progressive_download.txt` déclarant par
motif ce qui est téléchargé avant démarrage (`-`) ou à la demande (`+`), avec un
**placeholder pixellisé** en attendant l'image réelle.

**Naninovel.** `naninovel.com/guide`. Scripts `.nani`, `@goto Script#Label`,
imbrication par exactement quatre espaces. Variables globales par **préfixe de
nom** `G_`/`g_` uniquement, affectation par défaut `?=` qui n'écrase pas.
Modèle d'images : le décor est un **acteur unique persistant** qui change
d'apparence, la transition étant encodée dans le nom même de l'apparence —
`@back River.RadialBlur`. Adaptation au ratio d'écran par `Match Mode`
(Crop / Fit / Custom). Politique de ressources explicite : `Conservative`,
`Optimistic` ou `Lazy`, avec `@goto Script2 hold!` pour éviter un écran de
chargement. Trois catégories d'État : *Game state* par slot, *Global state*
partagé, *User settings* écrit hors du dossier de sauvegarde et « formatted in
a readable way so users can modify values if they wish ».

**Fungus.** `github.com/snozbot/fungus/wiki`. Flowchart → Blocks → Commands.
Variables *private* / *public* / *global*, ces dernières tenues par le
FungusManager et survivant au flowchart. Sauvegarde : un **Save History**
unique, chronologique, sérialisé en JSON dans PlayerPrefs, avec *Rewind* et
*Fast Forward* qui naviguent sans écrire — et un piège documenté : rembobiner
puis rejouer détruit définitivement les Save Points ultérieurs. Seuls Boolean,
Integer, Float et String sont sauvegardés.

### Inform 7 et Squiffy

**Inform 7.** `ganelson.github.io/inform-website`. Images : `Figure Woodlands
is the file "Woodlands.png".` — le nom peut être n'importe quel texte
commençant par le mot « Figure », la numérotation n'étant pas imposée puisque
l'ordre d'apparition n'est pas connu d'avance en fiction interactive. Ces
fonctions n'existent qu'en Glulx et la doc les qualifie de « relatively exotic
features ». Limite structurelle notable pour un produit qui assemble des images
et du texte : une image affichée « scrolls away, just as text does once
printed ».

Tests : `Test me with "up / kill captain eo".`, avec `holding …` pour donner des
objets et `in <Room>` pour téléporter, et des tests qui en appellent d'autres.
Le **Skein** mémorise « all the previous runs », les organise en fils, et la
doc en donne la métaphore explicite : traiter le récit « like the analysis of
other turn-based games, such as chess », en n'énumérant pas tout mais en
analysant les bifurcations significatives. Le point capital : le Skein **rejoue
intégralement la partie depuis le début**, là où Ren'Py restaure un instantané.
C'est la même famille que la Position de Frameline.

**Squiffy.** `docs.textadventures.co.uk/squiffy`. Deux unités : *sections*
`[[ ]]` majeures et *passages* `[ ]` révélés en ligne, avec la règle que
l'arrivée d'une nouvelle section désactive les liens de passage non cliqués de
la précédente. État sauvegardé automatiquement en localStorage, sans slots ni
rollback. Publication en HTML/JS autonome.

### Éditeurs à graphe

**articy:draft X.** `articy.com/help/adx`. Le vocabulaire est le plus proche du
nôtre et la distinction la plus utile à retenir est celle-ci : une **Condition
vit sur un *input pin* et n'a pas d'effet de bord** — « the game's flow can only
progress through this node, if the condition is met » — tandis qu'une
**Instruction vit sur un *output pin*** et « are executed as soon as the node is
left via this output-pin ». Les expressions ne s'écrivent **jamais sur les
connexions** : une connexion ne porte qu'un label cosmétique et une couleur.
C'est exactement le partage que Frameline fait déjà, à ceci près que nous
mettons les Conditions *sur* la Coupe et les Marqueurs *sur* la Scène d'arrivée.
Trois types de variables seulement (Boolean, Integer, String), toutes globales,
les Variable Sets n'étant que des espaces de noms. Un pin scripté est
**surligné en orange**. Le Simulation Mode évalue les conditions le long d'un
« temporary journey », marque chaque option valide ou invalide, et **surligne en
rouge la sous-partie de l'expression qui a échoué**. Le forecasting du Flow
Player Unity exécute les scripts en avance en modifiant temporairement les
variables puis en annulant, d'où l'obligation de tester `IsCalledInForecast`.

**Arcweave.** `docs.arcweave.com`. Element, branch, jumper, component. Une
branch a exactement un `if` obligatoire, n `elseif` et au plus un `else`, sans
`endif`. Quatre types d'attributs mais **aucun type numérique** — la doc dit
d'utiliser String pour les nombres — et les attributs ne sont **jamais visibles
en Play Mode**. Sémantique fine à retenir : le script d'un **label de
connexion** est évalué avant l'affichage du bouton, et exécuté après la
sélection du joueur, avant le chargement de la cible. Ergonomie remarquable :
tirer depuis le bord d'un element et lâcher dans le vide ouvre un menu
*Element / Jumper / Branch* qui **crée l'item et la connexion en un seul geste**
; poignées `automatic` qui se recollent au bord le plus proche, avec
surbrillance orange avant relâchement ; compteurs de mots par element, board et
projet, **arcscript exclu du décompte**, donc un vrai chiffre éditorial. Le
Play Mode permet d'éditer contenu et labels en place, et c'est le seul endroit
où l'on réordonne les options. Debugger avec **Previous value éditable**
recalculant immédiatement la valeur courante, les variables dépendantes, le
texte conditionnel et les options disponibles. Aucun linter narratif : la doc
signale qu'une condition redondante « will always be skipped » sans la
détecter. Export JSON avec `Include coordinates` pour un aller-retour de mise
en page, export **Markdown jouable et cliquable**, API REST **read-only** et
réservée au plan Team.

**Chat Mapper.** `docs.chatmapper.com` (cloud, relancé en 2026) et manuel PDF
1.7. C'est l'outil **le mieux outillé du corpus sur la validation narrative**.
Validation continue et *advisory* — les erreurs bloquent la publication, les
avertissements conseillent : identifiants dupliqués, **nœuds inatteignables**,
liens cassés ou orphelins, intégrité inter-conversations, **variables non
définies**, répliques parlées sans Actor, détection d'impasses. Réserve
importante : « variables jamais utilisées » n'est **pas** détecté, le contrôle
documenté étant l'inverse. Chaque cible d'export a en outre son *preflight*.
`SimStatus` par nœud vaut `"Untouched"`, `"WasOffered"` ou `"WasDisplayed"`,
ce qui permet des conditions du type « ce nœud n'a jamais été montré ».
Politique d'erreur fail-open : une condition non évaluable est **traitée comme
vraie et loguée**. Ergonomie : construction d'arbre **entièrement au clavier**
— `Tab` enfant, `Entrée` frère, `Ctrl+↑/↓` réordonner les frères, donc l'ordre
du menu joueur — édition inline par double-clic, minimap permanente,
insert-between qui scinde un lien. Un fichier audio **par segment de texte**,
segments délimités par `|`, avec un *Audio File Placer* qui assigne en masse
selon des conventions de nommage. Règle normative citée : un consommateur qui
ne sait pas honorer une balise « doit la retirer à l'affichage, jamais réécrire
la valeur stockée ».

**Dialogue Designer.** Manuel PDF v3.0 officiel. Arbre simple, START unique,
pas de nœud hub ni de nœud end — la fin est `next: null`. Trait structurant :
l'éditeur **n'évalue rien**, la condition est une **chaîne opaque** transmise au
moteur hôte, donc l'éditeur ne peut ni valider la syntaxe ni vérifier qu'une
variable existe. Aucun média, aucune API, aucun runtime officiel. Dernière
version 3.2.4 de janvier 2022.

**Rivet.** `rivet.ironcladapp.com/docs`. Graphes de nœuds à ports typés,
`DataValue {type, value}`, contrôle de flux **data-driven** : un If non
satisfait émet la sentinelle `control-flow-excluded` qui se propage à tous les
dépendants. Fichier projet **YAML** avec scalaires multi-lignes, donc diff git
lisible, et la doc recommande explicitement git comme seul filet de sécurité
face à l'absence d'undo sur la suppression d'un graph. **Trivet** est le seul
système de tests de récit du corpus après ChoiceScript : une suite = un graph
testé plus un **graph validateur**, avec un contrat imposé
(`input`, `output`, `expectedOutput` en entrée, N sorties booléennes), et
`Run With Iteration Count…` pour N répétitions avec agrégat — réponse assumée au
non-déterminisme. Projet en maintenance passive : npm figé en 1.25.0 depuis
2025-06-30, les derniers commits étant des bumps Dependabot.

**Charisma.ai.** `docs.charisma.ai` et code du SDK officiel. Story Graph par
scene ou subplot, avec Graph Entry et Graph Exit. Mémoire en cinq types plus
des Tags. Les connecteurs ne portent **qu'une priorité** ; les conditions sont
des **Gates**, nœuds à part entière. Règle d'or documentée : **toujours prévoir
une route non-gated**, sinon la story s'arrête — et « rien ne matche = la story
s'arrête ». Runtime temps réel hébergé sur **Colyseus** (et non socket.io,
vérifié dans `src/Playthrough.ts`), API REST `/play/*` sans GraphQL. Un
**Playthrough est lié définitivement à une version de story** : changer de
version impose un nouveau playthrough. Versionnage produit : draft → preview
versions immuables → versions publiées coexistantes dont une seule *promoted*,
retour arrière par `Promote`. Aucune validation automatique ; le filet est
**post-publication** : compteur de traversées sur chaque connecteur, analytics
par character node, transcripts avec bouton « Go to node ». Aucun export de ces
données. Collaboration : « Collaboration is not real-time », citation directe.

**H5P Branching Scenario 1.11.1.** `semantics.json` et `library.json` du dépôt
officiel `h5p/h5p-branching-scenario`. Modèle minimal et instructif par sa
pauvreté : une liste `content[]` de groupes portant `type` (une bibliothèque
H5P), `showContentTitle`, `proceedButtonText`, `forceContentFinished`, et un
**`nextContentId`** — c'est tout le branchement. **Aucune variable, aucune
condition** : seulement un score par fin (`endScreenScore`) et une
`scoringOption`. Un écran d'accueil avec `startScreenImage` et surtout
**`startScreenAltText`** au même rang que l'image. Un groupe `l10n` complet
avec `fullscreenAria`. `enableBackwardsNavigation` est un réglage global.

### Interactive film et photo-roman

**Stornaway.io.** `stornaway.io/interactive-tv-production`. Positionnement le
plus proche du nôtre. Le vocabulaire nommé sur la page officielle est
« Story Islands » (des séquences reliées), « hotspots » invisibles superposés,
« game logic » et une story map avec « real-time testing and control ». La page
ne documente ni variables, ni conditions, ni analytics, ni embed ; l'aide
produit (`help.stornaway.io`) n'a pas pu être récupérée (échec TLS). À traiter
comme concurrent direct sur le positionnement, non vérifiable sur le mécanisme.

**Storyteller (Benmergui / Annapurna).** Vérifié sur la page éditeur officielle
et la page Steam : c'est un **jeu de puzzle**, pas un outil d'auteur. Pas de
langage, pas d'export, pas d'API. Le seul enseignement est conceptuel : une
grammaire visuelle où décor plus personnages placés dans une case produit
mécaniquement un événement narratif.

## 3. Ce que les autres font dans le moteur

Le moteur de Frameline recalcule tout depuis la Position — la liste des Coupes
prises et le nombre de Plans laissés derrière dans la Scène courante — par une
marche pure (`shared/utils/reading.ts`, fonction `walk`). Voici ce que le
corpus dit de ce choix.

**Deux familles, pas trois.** Tout le corpus se répartit en deux modèles
d'État, et Frameline appartient à la famille minoritaire.

*Instantané sérialisé* : ink (`story.state.ToJson()` / `LoadJson`), SugarCube
(moments d'historique capturant toutes les variables `$`), Ren'Py (« saving the
game at the start of each statement »), Naninovel (JSON `.nson` par slot),
Fungus (Save History en PlayerPrefs), Chapbook (localStorage à chaque
navigation). L'État est la vérité, le chemin est perdu ou n'est qu'un
historique d'annulation.

*Rejeu depuis le début* : Inform 7 seul, par le Skein, qui « remembers and
automatically organises all the previous runs » et rejoue intégralement. C'est
la famille de Frameline.

**Ce que le rejeu achète, mesuré sur Inform.** Le Skein n'est pas un mécanisme
de sauvegarde, c'est un **arbre de tests gratuit** : puisque tout est rejoué,
toute partie passée est réexécutable contre le récit d'aujourd'hui, et une
divergence est un diff. Frameline a déjà cette propriété sans l'exploiter :
deux Lectures qui ont pris les mêmes Coupes *sont* la même Lecture, comme le dit
le commentaire de `Position`. La conséquence pratique est qu'une Position est
un cas de test valide, stable, et rejouable après modification du Récit.

**Ce que le rejeu coûte, mesuré sur Ren'Py.** Le prix documenté du modèle
instantané est le non-déterminisme : Ren'Py avertit qu'une statement qui
interagit plusieurs fois se recharge à son début, et SugarCube que sauvegarder
avant la création du moment enregistre l'ancienne valeur. Le prix symétrique du
modèle rejeu est que **tout doit rester déterministe pour toujours** : aucun
appel à l'horloge, aucun aléatoire non semé, aucune dépendance à l'ordre
d'insertion en base. Frameline y est exposé dès la première fonctionnalité
qui introduira du hasard.

**Le hasard reproductible est un besoin réel et il est résolu ailleurs.** Trois
outils du corpus l'ont traité explicitement : SugarCube remplace `Math.random()`
par `State.random()` **précisément pour que le tirage entre dans l'historique**,
et fournit `State.prng.init([seed])` ; Chapbook expose `config.random.seed` ;
ink a `SEED_RANDOM()`. Si Frameline ajoute un jour du hasard, la graine doit
faire partie de la Position, pas de l'État — sinon la Position cesse de
déterminer la Lecture et l'ADR 0020 tombe.

**Le calcul en avance est un piège connu.** Deux moteurs indépendants
documentent le même problème : ink expose `lookaheadSafe` sur chaque
`BindExternalFunction` parce que le moteur évalue en avance pour savoir quels
choix sont valides, et articy documente que son forecasting « exécute les
scripts en avance en modifiant temporairement les variables puis en annulant »
mais « ne peut pas annuler votre code utilisateur », d'où `IsCalledInForecast`.
Frameline est immunisé par construction : `holds` est une fonction pure sans
effet de bord et une Condition est plate (ADR 0004). C'est un avantage réel,
qui mérite d'être défendu explicitement contre toute proposition de Condition
appelant du code.

**Le compteur de visites est un citoyen de première classe partout.** ink :
« a knot or stitch used in this way is actually an integer variable ». Yarn :
`visited(node)` et `visited_count(node)`. Harlowe : `visits`, `turns`.
Chat Mapper : `SimStatus` à trois valeurs par nœud. Frameline compte déjà les
visites par Scène dans `State.visits` et les teste par une Condition
`at least` / `fewer than`. Ce que le corpus ajoute, c'est le troisième état de
Chat Mapper : *offert mais non pris*. Aucun autre outil ne le modélise, et
Frameline pourrait le faire à coût nul puisque la Position contient déjà les
Coupes prises et que les Coupes offertes sont recalculables à chaque pas.

**Le refus d'un choix : masquer ou griser.** Yarn Spinner « always delivers
every option » et laisse l'hôte griser ; Frameline retire la Coupe de la liste,
la rendant invisible plutôt que refusée. Le corpus valide notre position pour
le Lecteur, et valide aussi notre `unmet()` pour l'Auteur : c'est exactement le
« surlignage en rouge de la sous-partie fausse de l'expression » d'articy, en
plus lisible parce que nos Conditions sont plates.

**La reprise d'une Lecture n'est résolue par personne de manière satisfaisante
pour un lien public.** Chapbook sauvegarde silencieusement en localStorage à
chaque passage, sans slots, et assume que cela décourage le *save scumming*.
Squiffy fait pareil. C'est la seule réponse du corpus au cas « un Lecteur sans
compte revient sur le lien ». Pour Frameline, la Position est un tableau
d'identifiants de Coupes plus un entier : elle tient dans une URL ou dans un
`localStorage`, et sa validation est déjà écrite — `walk` s'arrête net sur une
Coupe qui n'existe plus ou dont les Conditions ne tenaient pas, « rather than
teleporting the Reader ». Le mécanisme de reprise est donc déjà là ; seul le
stockage manque.

## 4. Ce que les autres font dans l'éditeur

**Créer le nœud et l'arête d'un seul geste.** Arcweave : tirer depuis le bord
d'un element et lâcher dans le vide ouvre un menu *Element / Jumper / Branch*
qui crée l'item et la connexion ensemble. Twine 2 : taper `[[Nom]]` crée le
passage après une pause de frappe, et **réécrit les liens au renommage**.
articy : *Smart Create* crée la réplique suivante **en alternant
automatiquement le locuteur**. Les trois attaquent le même coût — l'aller-retour
entre créer et relier — par trois moyens différents. Frameline trace une Coupe à
la main (ADR 0015) et écrit une Scène dans un panneau au bord du banc (ADR
0021) : la version compatible est « tirer une Coupe et la lâcher dans le vide
ouvre le panneau sur une Scène neuve, déjà reliée ».

**Éditer dans le graphe sans quitter le graphe.** Chat Mapper édite en place
par double-clic sur le canvas ; Arcweave permet d'éditer contenu et labels
**depuis le Play Mode**, avec un indicateur *Editing* et la navigation
suspendue. Ce second point est le plus intéressant pour nous : il fusionne
Aperçu et édition sans faire de l'Aperçu un mode de l'éditeur, ce que le
glossaire interdit explicitement (« Not a mode of the editor »).

**Réordonner les sorties.** Chat Mapper : `Ctrl+↑/↓` réordonne les frères, donc
l'ordre du menu joueur, au clavier. Arcweave : le Play Mode est **le seul
endroit** où l'on réordonne les options, par glisser-déposer. Frameline a déjà
tranché que l'ordre des sorties est écrit et non dessiné (ADR 0007) ; le corpus
suggère seulement que le geste doit être atteignable au clavier.

**Le clavier comme mode d'édition principal.** Chat Mapper construit un arbre
entier sans souris : `Tab` enfant, `Entrée` frère, flèches pour naviguer,
`Home` racine. C'est aussi, de fait, la seule contribution d'accessibilité
sérieuse du corpus des éditeurs à graphe — Arcweave affirme au contraire que
« aside from text entry, all actions in a project can be performed with the
mouse », sans affirmation symétrique côté clavier, et ses 116 pages de
documentation ne contiennent aucune page d'accessibilité.

**Guider un débutant.** Trois approches distinctes. Inform 7 livre deux livres
interliés dans l'application, dont un tutoriel de ~500 exemples **cliquables et
jouables**, avec l'argument que lire dans l'app vaut mieux que sur le web parce
qu'« on peut cliquer et voir l'exemple fonctionner ». Naninovel fournit une
implémentation **Placeholder** d'acteur, générée, « pour maquetter sans art » —
l'auteur écrit sa structure avant d'avoir la moindre image. articy propose un
*Simulation Mode* qui montre pourquoi une option est invalide. Frameline a
l'Amorce (un Récit démonté plutôt que lu) et les Repères (un pas à la fois,
ancré au gabarit, ADR 0019) ; le Placeholder de Naninovel est la seule idée du
corpus qui n'y est pas déjà et qui n'entre en conflit avec rien.

**Prévisualiser.** articy *Simulation Mode* : évalue les Conditions le long
d'un parcours, marque chaque option valide ou invalide, offre un mode analyse
où les options fausses sont visibles en rouge, et **surligne la sous-partie de
l'expression qui a échoué**. Arcweave : *Debugger* avec **valeur précédente
éditable** recalculant immédiatement la valeur courante, les variables
dépendantes, le texte conditionnel et les options disponibles. Chapbook :
*Backstage* avec table des variables éditable en direct et **Snapshots nommés**
restaurant l'état complet. Frameline a déjà `unmet()`, qui repasse chaque
Condition une à une dans `holds` pour que l'explication et le masquage ne
puissent pas diverger — c'est plus rigoureux que tout ce que fait le corpus.
Ce qui manque est le geste inverse : **poser un Marqueur à la main dans
l'Aperçu** pour atteindre une branche sans rejouer le chemin, ce que Chapbook,
Arcweave et Charisma offrent tous les trois.

**Détecter les erreurs de structure.** Un seul outil du corpus le fait
sérieusement, et c'est Chat Mapper : nœuds inatteignables, liens cassés,
variables non définies, impasses, identifiants dupliqués, le tout en validation
continue avec erreurs bloquantes et avertissements consultatifs. Twine 2 se
limite à un compteur de « broken links » dans un panneau de statistiques.
Arcweave, Charisma, Dialogue Designer, Naninovel et Fungus n'ont rien. Ren'Py a
`lint` mais sans liste de contrôles documentée. La conclusion est nette :
**la détection de Scènes orphelines, de Coupes mortes et de Marqueurs jamais
posés ou jamais testés est un espace largement vide.** Sur la réserve de Chat
Mapper — « variables jamais utilisées » n'est pas détecté — Frameline est en
position de faire mieux, parce que ses Marqueurs sont une liste plate déclarée
par Scène (`sets`) et que ses Conditions sont plates : le rapprochement des deux
ensembles est une intersection, pas une analyse de flot.

## 5. Fonctionnalités candidates, classées valeur sur coût

Chaque entrée cite l'outil qui l'inspire et son statut vis-à-vis des ADR.

### Valeur forte, coût faible

**1. Diagnostic de structure du Récit — Scènes orphelines, Coupes mortes,
Marqueurs jamais posés ou jamais testés.** Inspiré de Chat Mapper Cloud
(validation continue *advisory*), qui est le seul du corpus à le faire, et qui
avoue ne pas détecter les variables inutilisées. Tout est calculable sur les
mêmes données que le Graphe : une Scène orpheline est une Scène qu'aucune Coupe
n'atteint et qui n'est pas la Scène d'ouverture ; une Coupe morte est une Coupe
dont les Conditions ne peuvent jamais tenir ; un Marqueur jamais testé est une
clé de `sets` absente de toute Condition, et l'inverse pour jamais posé.
**Compatible.** Renforce ADR 0004 (des Conditions plates rendent l'analyse
triviale) et ADR 0010 (le graphe est écrit ici, donc les données sont à portée).
Se teste sans base, comme le reste de la suite Vitest.

**2. Reprise d'une Lecture depuis la Position.** Inspiré de Chapbook
(sauvegarde silencieuse en localStorage à chaque navigation, sans slots, pour
décourager le *save scumming*) et de Squiffy. La Position est déjà un tableau
d'identifiants plus un entier, `walk` valide déjà une Position périmée en
s'arrêtant net. **Compatible.** ADR 0020 (« progress is the story ») et ADR 0003
(le lien public est l'id du Récit) tiennent : la Position vit côté Lecteur, pas
en base, donc aucune Lecture n'est partagée.

**3. Poser un Marqueur à la main dans l'Aperçu.** Inspiré de Backstage de
Chapbook (table des variables éditable en direct), du Debugger d'Arcweave
(valeur précédente éditable) et du Memory Setter de Charisma. Permet d'atteindre
une branche sans rejouer le chemin. **Compatible sous une condition** : cela ne
doit pas faire de l'Aperçu un mode de l'éditeur, ce que le glossaire interdit
(« Not a mode of the editor and not Publish »). La forme sûre est un État de
départ passé à l'Aperçu, pas une mutation du Récit.

**4. Description obligatoire ou explicitement vide sur un Photogramme.**
Inspiré de Chapbook, dont `{embed image: 'x.jpg', alt: '…'}` **exige** l'alt et
demande une chaîne vide pour une image décorative, et de H5P dont
`startScreenAltText` est au même rang que `startScreenImage`. **Compatible.** Le
glossaire dit déjà qu'une Description est écrite « for a Reader who cannot see
it » et que le texte du Plan ne peut jamais en tenir lieu ; il ne reste qu'à
rendre le choix explicite plutôt que tacite.

**5. Compteur de mots du Récit, texte des Plans seul.** Inspiré d'Arcweave, qui
compte par element, board et projet en **excluant arcscript du décompte** pour
donner un chiffre éditorial. Pour nous : le texte des Plans, sans les noms de
Scènes ni le texte des Coupes. **Compatible**, ne touche à aucune décision.

### Valeur forte, coût moyen

**6. Tirer une Coupe dans le vide pour créer la Scène d'arrivée.** Inspiré
d'Arcweave (le menu au lâcher qui crée l'item et la connexion ensemble) et de
Twine 2 (le passage créé en tapant son lien). **Compatible** avec ADR 0015 (une
Coupe se trace à la main — c'est toujours le cas) et ADR 0021 (la Scène s'écrit
dans un panneau au bord du banc — le panneau s'ouvre sur la Scène neuve).

**7. Scinder une Scène en deux à un Plan donné.** Inspiré du besoin qu'ADR 0001
nomme lui-même : « the answer is a "split Scene here" action in the editor, not
a change to this decision ». Le corpus ne l'offre nulle part, parce que personne
d'autre n'a une unité de branchement plus grosse que l'unité d'affichage.
**Compatible, et explicitement prévu par ADR 0001.** C'est la fonctionnalité qui
rend la décision d'ADR 0001 tenable dans la durée.

**8. Une Position est un cas de test rejouable.** Inspiré du Skein d'Inform 7,
qui mémorise toutes les parties, les organise en fils, et les rejoue depuis le
début. Frameline a déjà la propriété structurelle ; il manque de conserver des
Positions nommées et de les rejouer après modification du Récit. **Compatible**
et directement soutenu par ADR 0020.

**9. Photogramme suréchantillonné.** Inspiré du suffixe `@N` de Ren'Py, où
`eileen happy@2.png` déclare qu'un fichier 3840×2160 occupe une empreinte
logique de 1920×1080. Pour nous : servir un Photogramme au bon facteur selon
l'écran. **Compatible avec réserve** : ADR 0005 dit que l'image d'un Plan vit
dans la ligne du Plan. Plusieurs résolutions signifient plusieurs colonnes ou
une renégociation d'ADR 0005 — à traiter comme une décision, pas comme un
détail d'implémentation.

**10. Explication d'une Condition non tenue, avec la sous-partie fautive
soulignée.** Inspiré du Simulation Mode d'articy, qui « surligne en rouge la
sous-partie de l'expression qui a échoué ». Frameline a déjà `unmet()`, qui fait
mieux sur le fond ; l'apport est la mise en évidence dans l'écran de l'Aperçu.
**Compatible.**

### Valeur moyenne, coût moyen

**11. Marquer une Coupe « offerte mais non prise ».** Inspiré du `SimStatus` de
Chat Mapper à trois valeurs — `Untouched`, `WasOffered`, `WasDisplayed`. Aucun
autre outil ne le modélise. Calculable depuis la Position sans rien stocker.
**Compatible**, mais élargit le langage des Conditions ; à peser contre ADR
0004, qui protège l'absence de grammaire. Une Condition « la Coupe X a été
offerte » reste plate, donc recevable en principe.

**12. Export du Récit en un fichier texte versionnable.** Inspiré de Twee 3 et
Tweego (la doc Twine recommande de convertir en Twee avant de commiter parce que
le HTML compressé donne des diffs illisibles) et du YAML de Rivet (« scalaires
multi-lignes → diff git lisible »). **Compatible** ; à noter que
`demonstration/` fait déjà exactement cela dans l'autre sens, en écrivant un
Récit par l'API de l'éditeur.

**13. Placeholder de Photogramme.** Inspiré de l'implémentation *Placeholder*
de Naninovel, « pour maquetter sans art », qui laisse écrire la structure avant
d'avoir la moindre image. **Compatible** : le glossaire dit déjà qu'un Plan peut
porter du texte seul ; il s'agit d'un affichage, pas d'un Photogramme.

**14. Chargement progressif des Photogrammes à la Lecture.** Inspiré de
`progressive_download.txt` de Ren'Py web, avec son **placeholder pixellisé**
remplacé quand l'image arrive, et de la politique de ressources de Naninovel
(`Conservative` / `Optimistic` / `Lazy`, `hold!`). **Compatible** ; le
préchargement du Photogramme du Plan suivant est calculable puisque la Scène est
un parcours linéaire (ADR 0001), ce qui rend le problème beaucoup plus simple
que chez eux.

### À écarter — incompatible avec une décision déjà prise

**15. Brancher à l'intérieur d'une Scène.** ink (weave et gathers), Twine,
Arcweave et tout le reste du corpus le font. **Incompatible avec ADR 0001**, qui
nomme la contrepartie et la refuse : « It is more expressive […] but it
collapses the distinction we are actually selling ». La réponse est la
candidate 7, pas un changement de décision.

**16. Conditions composées, parenthèses, `or`, `not`.** ink, Yarn, SugarCube,
Harlowe, Arcweave et Chat Mapper en ont tous. **Incompatible avec ADR 0004**,
qui précise que la décision « protège l'absence d'un parseur » et que la
conjonction n'a été admise que parce qu'elle coûte un `every`. Ajouter `or`
introduit une grammaire, donc un parseur, donc un langage à documenter et à
localiser.

**17. Effets de bord dans une Condition, ou script exécuté sur une Coupe.**
articy (Instruction sur pin de sortie), Arcweave (script de label exécuté après
sélection), Chat Mapper (`UserScript`), Charisma (Function nodes JS). Chez
Frameline, un Marqueur est posé par la Scène d'arrivée, à chaque entrée.
**Incompatible avec ADR 0004** et avec la pureté de `holds`, qui est ce qui nous
immunise contre le piège du lookahead documenté par ink et articy.

**18. Bibliothèque de graphe tierce, disposition automatique.** articy et
Arcweave en ont. **Incompatible avec ADR 0010** (« the graph is written here,
not pulled in ») et avec ADR 0007 (l'ordre des sorties est écrit, pas dessiné).

**19. Variables typées, nombres, listes, ensembles.** ink (`LIST`), Yarn (trois
types), articy (Boolean / Integer / String), Rivet (`DataValue`). Le Marqueur de
Frameline est « a single named value » et `Flags` est un
`Record<string, string>`. **Incompatible en l'état avec ADR 0004** et avec le
glossaire ; à traiter comme une renégociation explicite si le besoin se
présente.

**20. Traduction d'un Récit.** articy (plugin Localization XLSX protégé par mot
de passe), Arcweave (Translation Mode à quatre statuts), Ren'Py (blocs
`translate` et **assets localisés par arborescence parallèle**), Charisma (15
langues, auto-translate). **Incompatible avec le glossaire et ADR 0013** :
« Nothing translates a Story », un Récit écrit en français est lu en français
par tout le monde. Ce qui reste compatible et non fait est l'i18n de
l'interface, déjà couverte par les deux fichiers de messages, et l'idée
transposable de Ren'Py — un Photogramme distinct par Langue — relève de ADR
0018 (une Amorce par Langue), pas de la traduction.

**21. Collaboration multi-auteur temps réel.** articy:server (Perforce ou
Subversion, partitions réservées), Arcweave (« co-create in real time », sans
mécanisme documenté), Chat Mapper Cloud (concurrence optimiste avec bannière de
conflit). **Incompatible avec le glossaire** : un Récit est « owned by one
Author », et l'Auteur est « the only actor who can change anything ». À écarter
tant que cette phrase tient.

## 6. Trous — ce qui n'a pas pu être vérifié en source primaire

**Non couverts faute de source primaire accessible.**

- **Moiki** (`moiki.fr`). Le site est une application rendue côté client : le
  HTML servi ne contient que le mot « Moiki » et un logo en data-URI. FAQ,
  documentation et tutoriels sont inaccessibles à une récupération HTTP. Tout ce
  qui circule sur son modèle (séquences, variables, objets, compteurs, contrôle
  des erreurs) provient de sources pédagogiques secondaires et n'est donc pas
  cité ici. C'est le trou le plus regrettable, Moiki étant francophone et
  positionné sur le même public que l'Amorce et les Repères.
- **Episode Interactive**. Le portail auteur et le centre d'aide officiel
  (`pocketgems-support.helpshift.com`, `episodesupport.zendesk.com`) renvoient
  HTTP 403 à toute récupération automatisée. Les titres d'articles officiels
  sont visibles via l'index de recherche, mais leur contenu ne l'est pas. La
  syntaxe rapportée (`INT. PLACE NAME - DAY`, commandes `@`, zones de spot
  directing) doit être relue à la main dans un navigateur avant d'être tenue
  pour acquise.
- **Chapters (Crazy Maple Studios)**. Seul un communiqué de 2021 est public.
  La nature de l'outil — éditeur visuel ou langage de script —, le catalogue
  d'assets, le processus de publication et tout ce qui touche à l'export, à la
  sauvegarde, à l'accessibilité et à l'i18n exigent la création d'un compte sur
  `ugc.crazymaplestudios.com`.
- **Stornaway.io**. `help.stornaway.io` échoue au handshake TLS. Seule la page
  produit publique a pu être lue, et elle ne documente ni variables, ni
  conditions, ni analytics, ni embed. C'est le concurrent le plus proche par le
  positionnement et le moins documenté du lot.
- **Dialogue Designer**. Les pages itch.io de l'éditeur renvoient HTTP 403. Le
  rapport s'appuie sur le manuel PDF officiel hébergé par Valve et l'API news
  Steam. Le contenu de l'« Export to .txt » ajouté en 3.0.9 reste inconnu.
- **Naninovel**. La page `/guide/automated-testing` existe au sommaire mais
  n'a pas pu être récupérée : **le mécanisme de tests de Naninovel n'est pas
  vérifié**. Son mécanisme de **rollback** n'est pas davantage documenté : les
  pages `state-management` et `input-processing` ne donnent que le binding de
  l'action *Rollback* et le réglage `StateRollbackSteps`, sans dire si c'est un
  rejeu ou une restauration d'instantané.

**Vérifié partiellement, à ne pas tenir pour acquis.**

- **Harlowe** : le support de stockage réel de `(save-game:)` en Harlowe 3. Le
  cookbook, écrit pour Harlowe 2, dit « cookies » ; le manuel 3.3.8 ne le
  confirme pas dans les sections récupérables. Le dépôt officiel
  (foss.heptapod.net) est protégé par Anubis et inaccessible. Aucune
  documentation d'accessibilité ni d'API JavaScript publique n'a été trouvée.
- **Ren'Py** : le préchargement et le cache d'images. `performance.html` et
  `lint.html` renvoient 404 et l'index ne liste pas de page « Performance » ;
  `renpy.start_predict`, `config.predict_statements` et la taille du cache
  n'ont pas été vérifiés. La liste exacte des contrôles de `lint` n'est
  documentée nulle part. `config.rollback_enabled` et
  `config.hard_rollback_limit` sont référencés sans être décrits. Le Skein
  d'Inform est documenté, mais le panneau Transcript et le « blessing » des
  transcriptions ne le sont pas dans le chapitre 1.7.
- **Inform 7** : les chapitres 24.3 à 24.5 (commandes de débogage de haut et bas
  niveau, retrait des commandes de test à la publication) n'ont pas été lus.
  `ACTIONS`, `RULES`, `GONEAR`, `PURLOIN` ne sont pas vérifiés.
- **Yarn Spinner** : la portée exacte des variables (globale seule ou non), les
  *smart variables*, `<<jump>>` contre `<<detour>>`, et le mécanisme de
  localisation par lignes `#line:xxxx` avec tables de chaînes CSV n'ont pas été
  lus en source primaire — la page « variables and functions » visée n'existe
  plus et la documentation a migré vers un format interrogeable en `.md`.
- **ChoiceScript** : `quicktest.js` se contente de charger `autotest.js` ; la
  stratégie exacte de parcours d'`autotest.js` (exhaustive sur toutes les
  options, ou heuristique) n'a pas été lue en entier. Le README du dépôt
  renvoie 404, et la documentation communautaire de référence
  (`choicescriptdev.fandom.com`) répond HTTP 402.
- **articy** : le schéma JSON complet de l'export n'est pas énuméré dans la
  documentation — seul le XML a un XSD. Le nom du package NuGet de l'API et le
  format de sortie exact des exports Unity et Unreal ne sont pas attestés.
- **Twine 2** : aucune détection de passage orphelin n'est documentée ; il n'a
  pas été possible d'établir si l'absence est une lacune ou une décision.
  `twinery.org/reference` et `twinery.org/cookbook` renvoient 403, le travail a
  été fait sur les dépôts sources en amont.
- **H5P** : seuls `semantics.json` et `library.json` ont été lus ; le mécanisme
  d'état et de reprise (`getCurrentState` / `previousState` du cœur H5P) n'a pas
  été vérifié dans `src/`.

**Non recherché faute de pertinence établie.** Monogatari, TyranoBuilder et
Visual Novel Maker n'ont pas été traités. Storyteller a été vérifié puis
écarté : c'est un jeu de puzzle commercial, pas un outil d'auteur.
