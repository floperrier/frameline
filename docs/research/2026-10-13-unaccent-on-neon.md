# L'extension `unaccent` sur Neon

Recherche menée le 2026-10-13, en sources primaires uniquement : la
documentation de Neon et celle de PostgreSQL. La question vient de la spec #501 :
la recherche du Catalogue doit ignorer les accents (*memoire* trouve *Mémoire*),
et elle ne le peut par `unaccent` que si Neon permet de l'installer.

## Réponse

Oui. Neon liste `unaccent` parmi ses extensions prises en charge, en version 1.1
pour chacune des versions de Postgres qu'il sert, de 14 à 18, sans note
particulière [neon-extensions]. Elle s'active par une simple instruction :

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

que la page de Neon consacrée à l'extension donne telle quelle [neon-unaccent].

## Qui peut l'installer

PostgreSQL range `unaccent` parmi les modules « trusted » : il « can be
installed by non-superusers who have `CREATE` privilege on the current
database » [pg-unaccent]. Le rôle qui applique les migrations est le
propriétaire de la base, qui a ce privilège ; une migration peut donc porter
l'instruction. Les pages de Neon ne disent pas quel rôle est requis, ce que la
qualité de module « trusted » rend sans objet.

Seule la modification des règles (`unaccent.rules`) demande des privilèges
qu'un utilisateur de Neon n'a pas [neon-unaccent] ; les règles par défaut
suffisent ici.

## Ce qu'il faut savoir pour l'écrire

- Signature : `unaccent([dictionary regdictionary, ] string text) returns text`
  [pg-unaccent].
- La fonction n'est pas `IMMUTABLE` [neon-unaccent] : elle ne peut pas entrer
  telle quelle dans un index d'expression. La spec n'en demande aucun à quelques
  centaines de Récits, si bien que la contrainte ne joue pas.
- Neon conseille de qualifier la fonction par son schéma, `public.unaccent`,
  pour ne pas dépendre du `search_path` [neon-unaccent].
- La forme recommandée pour une recherche insensible à la casse et aux accents
  applique `unaccent` des deux côtés d'un `ILIKE` [neon-unaccent] :
  `unaccent(name) ILIKE unaccent('%cafe%')`.

## Localement

La base de la suite et celle de `pnpm dev` tournent sur l'image officielle
`postgres:18` (`compose.yaml`), qui embarque les modules contrib, dont
`unaccent` : la même migration s'y applique.

## Sources

- [neon-extensions] Neon, *Supported Postgres extensions* —
  https://neon.com/docs/extensions/pg-extensions
- [neon-unaccent] Neon, *The unaccent extension* —
  https://neon.com/docs/extensions/unaccent
- [pg-unaccent] PostgreSQL, *unaccent — a text search dictionary which
  removes diacritics* — https://www.postgresql.org/docs/current/unaccent.html
