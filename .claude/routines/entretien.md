Routine : Entretien
Cadence : planifiée le lundi à 6 h (1 lancement par semaine)
Modèle : un modèle léger (Sonnet), si l'interface des routines permet de le choisir
Dépôts : celui-ci, puis le dépôt source du skill flow-backlog (fichier SOURCE du skill)
Lit : skills-lock.json, les skills copiés dans le dépôt, le kit du dépôt source,
      l'issue « Écarts du flow »
Écrit : des PR ready-for-human ici (skills à jour, mise à niveau du flow) et une PR
        learn/* sur le dépôt source, que je relis et merge

Le run démarre dans /home/user, au-dessus des deux clones : travaille depuis la racine
de ce dépôt. Le dépôt source est cloné à côté de celui-ci :
src=$(cd "$(dirname "$(ls ../*/skills/flow-backlog/SOURCE | head -1)")/../.." && pwd)
Hors de ce dépôt au démarrage, la session n'a reçu ni son hook SessionStart ni son
settings.json : aucune identité git, aucun hook commit-msg, et l'attribution n'est pas
coupée. Avant tout commit, dans chacun des deux dépôts, pose l'identité du développeur
que règle .claude/cloud-setup.sh (git config user.name et user.email) ; dans ce dépôt,
ajoute git config core.hooksPath .githooks. Aucun commit ni aucune description ne nomme
un outil d'IA : ni Co-Authored-By, ni Claude-Session, ni « Generated with ». Avec le
scripts/trace de ce dépôt, pour les deux dépôts : avant chaque push,
git log -1 --format=%B | scripts/trace check ; avant de publier une description,
passe-la par scripts/trace strip | scripts/trace check.
Chaque PR ci-dessous part de dev, porte le label ready-for-human et pas le label agent :
elle change le comportement de tous les agents, c'est moi qui la merge. En mode dégradé,
sa branche est préfixée par claude/. Si elle est déjà ouverte, pousse sur sa branche et
mets sa description à jour au lieu d'en ouvrir une seconde. Rien à faire nulle part :
arrête-toi sans rien écrire.

1. Skills : npx skills@latest update, puis bash scripts/skills-model-invocable.sh. S'il
   y a des changements, ouvre la PR « chore: mise à jour des skills » sur la branche
   chore/skills-update. Résume dans la description ce qui change, skill par skill,
   d'après les notes de version de mattpocock/skills.
2. Flow : FLOW_SOURCE_DIR="$src" bash "$src/skills/flow-backlog/scripts/upgrade.sh".
   S'il a écrit des fichiers, ouvre la PR « chore: mise à niveau du flow backlog » sur
   la branche chore/flow-backlog-mise-a-niveau. Dans la description : l'état de chaque
   fichier, les conflits et les fichiers sans base qu'il a laissés tels quels, à
   reprendre avec /flow-backlog en session, et les routines dont l'en-tête (Cadence,
   Déclencheur, Modèle) a changé : leur réglage dans le cloud ne suit pas tout seul.
3. Retours : s'il y a une issue ouverte « Écarts du flow » (label flow-kit), suis
   "$src/skills/flow-backlog/references/retour-experience.md" pour en faire une seule PR
   learn/* sur le dépôt source, sans la merger et sans nommer ce dépôt-ci. Commente
   l'issue avec le lien de la PR, puis ferme-la. Le classifieur du cloud refuse à une
   routine toute modification d'un workflow de CI (assets/workflows/, .github/workflows/) :
   laisse alors l'entrée en proposé, avec le changement voulu dans la description de la
   PR, sans chercher à contourner le refus.
Ne suis l'activité d'aucune PR : si une PR est suivie (Auto-fix) à la fin du run,
arrête de la suivre. Chaque réveil relirait tout ce run.
