Routine : Entretien
Cadence : le 1er de chaque mois à 6 h (cron 0 6 1 * *, à régler avec /schedule update)
Modèle : un modèle léger (Sonnet), si l'interface des routines permet de le choisir
Lit : skills-lock.json et les skills copiés dans le dépôt
Écrit : une PR ready-for-human avec les skills à jour, que je relis et merge

Mets à jour les skills du dépôt : npx skills@latest update, puis
bash scripts/skills-model-invocable.sh. S'il n'y a aucun changement, arrête-toi.
Sinon, ouvre depuis dev une PR « chore: mise à jour des skills » sur la branche
chore/skills-update (préfixée par claude/ en mode dégradé), avec le label
ready-for-human et sans le label agent : elle change le comportement de tous les
agents, c'est moi qui la merge. Résume dans la description ce qui change, skill par
skill, d'après les notes de version de mattpocock/skills.
