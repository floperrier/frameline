Routine : Entretien
Cadence : planifiée le lundi à 6 h (1 lancement par semaine)
Modèle : un modèle léger (Sonnet), si l'interface des routines permet de le choisir
Dépôts : celui-ci, puis le dépôt source du skill flow-backlog (fichier SOURCE du skill)
Lit : skills-lock.json, les skills copiés dans le dépôt, le kit du dépôt source,
      l'issue « Écarts du flow »
Écrit : des PR ready-for-human ici (skills à jour, mise à niveau du flow) et une PR
        learn/* sur le dépôt source, que je relis et merge

Le dépôt source est cloné à côté de celui-ci :
src=$(cd "$(dirname "$(ls ../*/skills/flow-backlog/SOURCE | head -1)")/../.." && pwd)
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
   l'issue avec le lien de la PR, puis ferme-la.
