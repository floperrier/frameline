# Où vivent les octets des Images et des Sons, et ce que cela coûte

Recherche menée le 2026-10-11, en sources primaires uniquement : pages de prix
et documentation officielles de Neon, Vercel, Cloudflare et AWS, fichiers de
l'AWS Price List API et documentation de PostgreSQL. Chaque chiffre renvoie à la
page qui le porte (liens en fin de note). Les prix sont en dollars US, hors
taxes. Là où une source est ambiguë ou muette, la note le dit plutôt que de
deviner, et la section 9 rassemble ces trous.

Point de départ. Une Image (130 à 200 Ko en WebP ou JPEG, plafond 2 Mo) et un Son
sont stockés en `bytea` dans Postgres sur Neon. Une fonction Vercel les sert,
Neon → fonction → Lecteur, avec `cache-control: no-store` et sans CDN :
`server/api/read/[id]/media/[digest].get.ts` pour une édition publiée, et
`server/api/shots/[id]/image.get.ts` pour le banc et l'Aperçu. La connexion
passe par `drizzle-orm/neon-http`. Le projet Neon est sur le plan Free et a été
suspendu ce mois-ci après avoir dépassé 5 Go de transfert réseau. Une Lecture
complète d'un Récit de 40 Plans fait environ 40 requêtes d'image.

Quatre options sont comparées :

- **A** : passer Neon au plan Launch et garder les octets en base.
- **B** : garder les octets en base et mettre le CDN de Vercel devant la route
  média publiée, purgé par tag de cache à la dépublication ou à la suppression.
- **C** : déplacer les octets dans un bucket privé (Cloudflare R2 ou AWS S3) et
  servir des URL présignées de courte durée.
- **D** : déplacer les octets dans le stockage privé de Vercel Blob.

## 1. Neon

### Plan Free

| Ressource | Limite | Au-delà |
| --- | --- | --- |
| Calcul | 100 CU-heures par projet et par mois, soit environ 400 h pour un calcul de 0,25 CU ; autoscaling jusqu'à 2 CU (8 Go de RAM) [neon-pricing] [neon-plans] | calcul suspendu jusqu'à la période suivante ou jusqu'à une montée de plan |
| Stockage Postgres | 1 Go par projet, 20 Go au total sur le compte, plafonds appliqués séparément [neon-plans] | les écritures qui font grossir le stockage échouent « until you free space or upgrade » |
| Transfert réseau public (egress) | 5 Go par projet et par mois [neon-transfer] | « Exceeding this suspends your compute until the next billing cycle or you upgrade » |
| Branches | 10 par projet | la création de branches échoue |
| Scale-to-zero | après 5 min d'inactivité, fixe sur Free [neon-stz] | — |

Le calcul et le transfert repartent à zéro à chaque période mensuelle de
facturation ; le stockage est une limite continue [neon-plans]. « None of these
limits delete your data » [neon-pricing]. Pendant la suspension, « Existing
connections drop and new ones can't open », et Neon ne facture aucun dépassement
sur Free [neon-faq].

Ce qui compte comme egress : « Neon measures data sent from your databases
through the Neon proxy to clients », connexions poolées comme directes, en
sortie uniquement [neon-transfer]. Toutes les lectures de Frameline y passent :
celles du Lecteur, mais aussi celles du banc et de l'Aperçu.

**Hypothèse non vérifiée, à mesurer.** `drizzle-orm/neon-http` interroge Neon en
HTTP. Si un `bytea` y voyage au format texte, PostgreSQL le sort en hex par
défaut, « 2 hexadecimal digits per byte » [pg-bytea], et une Image de 200 Ko
coûterait alors environ 400 Ko d'egress. La page du pilote serverless ne
documente ni l'encodage des résultats, ni une éventuelle compression ; elle
donne seulement une taille maximale de réponse HTTP de 64 Mo [neon-driver].

### Plan Launch

| Poste | Prix |
| --- | --- |
| Minimum mensuel | aucun : « no monthly minimum », et « Invoices under $0.50 are not collected » [neon-pricing] |
| Calcul | 0,106 $ par CU-heure, jusqu'à 16 CU (64 Go de RAM) ; aucune allocation gratuite n'est indiquée [neon-pricing] |
| Stockage | 0,35 $ par Go-mois, mesuré à l'heure [neon-plans] |
| Instant restore (historique) | 0,20 $ par Go-mois, jusqu'à 7 jours, 1 jour par défaut, sur les branches racines seulement [neon-plans] |
| Transfert public | 500 Go par projet et par mois inclus, puis 0,10 $ par Go [neon-transfer] |
| Transfert privé | non proposé sur Launch (Scale seulement, 0,01 $ par Go) [neon-plans] |
| Branches | 10 incluses, puis 1,50 $ par branche-mois, proratisé à l'heure [neon-plans] |
| Autres postes | snapshots 0,09 $ par Go-mois ; Object Storage 0,023 $ par Go-mois ; Functions 0,10 $ par Capacity-Hour active, 0,025 $ en attente, 0,60 $ par million d'invocations [neon-plans] |
| Scale-to-zero | désactivable sur les plans payants [neon-stz] |

Ordre de grandeur du calcul : un calcul de 0,25 CU éveillé en permanence pendant
un mois de 730 h consomme 182,5 CU-h, soit environ 19 $. Ce chiffre est
indépendant de l'endroit où vivent les médias : la page de Lecture interroge la
base dans toutes les options.

**Montée de plan en cours de mois.** Le changement se fait depuis la console,
*Billing* puis *Change plan* [neon-billing]. La page de prix dit « Upgrade to
lift any limit immediately » [neon-pricing], et la FAQ dit que le calcul reprend
« when the next monthly window opens or you move to a paid plan » [neon-faq].
Mais la page de facturation précise qu'après une montée de plan, « your compute
will only pick up the new plan limits ... after the compute restarts », avec un
lien vers la procédure de redémarrage [neon-billing] : il faut donc s'attendre à
devoir redémarrer le calcul à la main. Aucune page ne parle de proratisation. Le
plan Launch n'ayant pas de part fixe, il n'y a rien à proratiser : l'usage est
facturé à partir de la montée de plan. C'est une déduction, pas une phrase de
Neon. Le prélèvement a lieu « on the first day of the month » [neon-billing], ce
qui laisse penser que la période suit le mois calendaire ; la FAQ ne le dit pas
explicitement.

**Aparté : Neon Object Storage.** Stockage compatible S3, intégré au projet :
5 Go par projet sur Free, 0,023 $ par Go-mois sur les plans payants, sans frais
par opération [neon-plans] [neon-storage]. Mais « Data transferred out counts
toward your public network transfer allowance », allocation « shared across all
products in that project » [neon-plans]. Sur Free, servir les Images depuis ce
stockage consommerait donc les mêmes 5 Go que la base : cela ne règle pas la
suspension. Sur Launch, cela tient dans les 500 Go inclus.

## 2. Vercel : Hobby et Pro pour servir des médias par une fonction

| Ressource | Hobby (inclus) | Pro (prix) |
| --- | --- | --- |
| Socle | gratuit | 20 $ par mois, avec 20 $ de crédit d'usage mensuel et un siège de déploiement [vercel-pro] |
| Invocations de fonction | 1 000 000 | 0,60 $ par million [vercel-functions] |
| Active CPU | 4 h | 0,128 $/h (iad1) à 0,177 $/h (cdg1) [vercel-functions] |
| Provisioned Memory | 360 Go-h | 0,0106 $ (iad1) à 0,0146 $ (cdg1) par Go-h [vercel-functions] |
| Fast Data Transfer (CDN → visiteur) | 100 Go | couvert par Flat Rate CDN (palier inclus : 1 To), sinon 0,15 $ par Go en iad1 comme en cdg1 [vercel-flat] [vercel-cdg1] [vercel-iad1] |
| Fast Origin Transfer (fonction ↔ CDN) | 10 Go | 0,06 $ par Go en iad1 comme en cdg1 ; facturé à l'usage, hors Flat Rate [vercel-pricing] [vercel-cdg1] |
| Requêtes CDN | 1 000 000 | palier inclus de Flat Rate, puis 2,00 $ (iad1) à 2,40 $ (cdg1) par million [vercel-cdg1] [vercel-iad1] |

Définitions : Active CPU ne compte que le temps où le code tourne, « not during
I/O operations (database queries...) », tandis que Provisioned Memory court
pendant toute la vie de l'instance, attente d'I/O comprise [vercel-functions].
Fast Data Transfer mesure les octets entre le CDN et l'appareil du visiteur ;
Fast Origin Transfer, ceux entre le CDN et les fonctions [vercel-cdn-usage]. Une
Image servie aujourd'hui sans cache paie donc deux fois son poids côté Vercel :
une fois en Fast Origin Transfer, une fois en Fast Data Transfer.

Le projet `frameline` n'a pas de `regions` dans `vercel.json`. Or « By default,
Vercel Functions execute in Washington, D.C., USA (iad1) for all new projects »
[vercel-region]. Le réglage du tableau de bord n'a pas été vérifié.

**Hobby au-delà d'une limite.** Hobby est plafonné : les comptes Hobby « are
limited to the usage caps and cannot purchase additional usage » [vercel-price].
« In most cases, if you exceed your usage limits on the Hobby plan, you will have
to wait until 30 days have passed before you can use the feature again »
[vercel-hobby].

**Usage commercial.** « Our Hobby plan is for personal, non-commercial use »
[vercel-price]. Est commercial tout déploiement servant « the purpose of
financial gain of anyone involved in any part of the production of the
project » : paiement des visiteurs, publicité, vente d'un produit ou d'un
service. Les dons n'en font pas partie [vercel-fair].

**Deux contradictions dans les sources Vercel.**

- *Requêtes CDN incluses en Pro.* La page de prix affiche « 10M / month
  included » [vercel-price], tandis que la doc du plan Pro et celle de Flat Rate
  CDN donnent 1 million [vercel-pro] [vercel-flat]. La note retient 1 million.
  Aux volumes de la section 8, la différence ne change rien.
- *Éligibilité de Flat Rate CDN.* Flat Rate CDN exclut « Large-scale delivery of
  media or files where such delivery constitutes a majority of bandwidth
  usage ». En cas de dépassement, Vercel peut déplacer le projet sur Flex CDN,
  exiger une migration ou limiter le service [vercel-flat]. Flex CDN est
  « best-effort », sans garantie de latence ni de disponibilité, et sa doc ne
  donne aucun prix [vercel-cdn]. La bande passante de Frameline est
  majoritairement faite d'Images. Les guidelines rangent par ailleurs
  « Media hosting for hot-linking » parmi les usages « Never fair use »
  [vercel-fair] ; ce n'est pas le cas de Frameline, mais c'est la même famille
  de risque.

## 3. Le CDN de Vercel devant une fonction (option B)

**Cacher au CDN sans laisser le navigateur garder l'Image.** Vercel lit trois
en-têtes, par ordre de priorité : `Vercel-CDN-Cache-Control`, puis
`CDN-Cache-Control`, puis `Cache-Control` [vercel-cc]. `Vercel-CDN-Cache-Control`
« controls caching behavior only within Vercel's Cache » ; le CDN le consomme et
ne le transmet ni au navigateur ni aux autres CDN [vercel-cc]. `CDN-Cache-Control`,
lui, est renvoyé au navigateur, qui l'ignore [vercel-cdn-cache]. Quand l'un des
deux est présent, `Cache-Control` part tel quel vers le client [vercel-cc].

**Ambiguïté.** La liste des critères de mise en cache exige que la réponse « doesn't
contain the `private`, `no-cache` or `no-store` directives in the
`Cache-Control` header » [vercel-cdn-cache]. Aucune page ne dit si cette règle
s'applique encore quand `Vercel-CDN-Cache-Control` est présent ; le guide de la
base de connaissances ne traite pas ce cas non plus [vercel-kb-cc]. La
combinaison `Cache-Control: no-store` et `Vercel-CDN-Cache-Control: max-age=…`
est donc à tester : la réponse doit revenir avec `x-vercel-cache: HIT` au
deuxième appel. Si le test échoue, `Cache-Control: public, max-age=0,
must-revalidate` est sans ambiguïté. C'est d'ailleurs la valeur par défaut de
Vercel, qui « instructs both the CDN and the browser not to cache »
[vercel-cc] : le navigateur peut garder une copie sur disque, mais doit la
revalider avant chaque usage.

**Autres conditions de mise en cache** [vercel-cdn-cache] :

- requête `GET` ou `HEAD`, sans en-tête `Range` ni `Authorization` ;
- statut 200, 404, 410, 301, 302, 307 ou 308 ;
- réponse de 10 Mo au plus (20 Mo en streaming) ;
- aucun `Set-Cookie` ;
- aucun `Vary: *`, aucun `Vary: Cookie`.

Deux de ces conditions concernent directement Frameline. Un `<audio>` envoie
souvent des requêtes `Range`, qui ne sont pas mises en cache ; la doc de
Frameline dit qu'un Son est chargé en octets, ce qui devrait éviter le problème,
mais c'est à vérifier. Et la route média ne doit émettre aucun `Set-Cookie`.

**Durée et portée du cache.** La durée maximale est d'un an, mais « cache times
are best-effort and not guaranteed », et une entrée rarement demandée peut être
évincée de son cache régional [vercel-cdn-cache]. La clé de cache comprend l'URL
unique du déploiement : chaque déploiement repart d'un cache froid
[vercel-purge] [vercel-status].

**Un HIT n'invoque pas la fonction.** « The response was served directly from the
cache, with no function invocation or origin fetch needed » [vercel-status]. Un
HIT compte quand même comme requête CDN et comme Fast Data Transfer
[vercel-cdn-usage].

**Tags de cache.** L'en-tête de réponse `Vercel-Cache-Tag` porte une liste de
tags séparés par des virgules ; `addCacheTag()` de `@vercel/functions` fait la
même chose [vercel-purge]. Les tags sont propres au projet et à l'environnement
(production ou preview). Limites : 256 octets UTF-8 par tag, 128 tags par
réponse en cache, 16 tags par appel REST groupé [vercel-purge]. La fonctionnalité
est disponible « on all plans at no additional cost » depuis le 2026-01-28 pour
toutes les réponses [vercel-cl-tags].

**Purge.** Il y a deux sémantiques, et la différence compte pour une
dépublication [vercel-purge] [vercel-status] :

- *Invalider* (`invalidateByTag()`, `POST /v1/edge-cache/invalidate-by-tags`,
  `vercel cache invalidate --tag`) marque les entrées comme périmées. La requête
  suivante **sert encore l'ancienne réponse** pendant que la revalidation se fait
  en arrière-plan.
- *Supprimer* (`dangerouslyDeleteByTag()`, `/dangerously-delete-by-tag`,
  `vercel cache dangerously-delete --tag`) force la requête suivante à
  regénérer la réponse avant de répondre. C'est la sémantique qui convient à une
  dépublication : le changelog la réserve au cas où « the origin content is
  gone » [vercel-cl-purge].

La purge est disponible sur tous les plans [vercel-purge]. Elle n'est pas
facturée en elle-même, mais elle peut faire monter les invocations et le Fast
Origin Transfer qui suivent [vercel-purge]. **Le délai de propagation d'une purge
n'est donné nulle part** : ni dans la doc, ni dans les deux changelogs
[vercel-purge] [vercel-cl-purge] [vercel-cl-tags]. La référence REST ne donne pas
non plus de limite de débit [vercel-rest-purge].

## 4. Vercel Blob en stockage privé (option D)

**Statut.** Le stockage privé est en disponibilité générale depuis le 2026-06-30,
sur tous les plans ; les Signed URLs et l'authentification OIDC sont sorties de
bêta en même temps [vercel-cl-blob]. Il faut `@vercel/blob` 2.3 ou plus
[vercel-blob-private].

**Comment un navigateur lit un blob privé.** Il y a deux voies.

- *Par une fonction.* La doc de référence fait passer la lecture par une route
  qui authentifie, appelle `get()` et renvoie le flux [vercel-blob-private]. On
  paie alors Blob Data Transfer, plus Fast Origin Transfer en cas de miss, pour
  la lecture du store par la fonction ; puis Fast Data Transfer et Fast Origin
  Transfer pour la réponse au navigateur [vercel-blob-private]. Vercel déconseille
  par ailleurs de mettre ces réponses au cache CDN avec `s-maxage`
  [vercel-blob-private].
- *Par une URL signée.* `issueSignedToken()` sur le serveur, puis `presignUrl()`
  avec `operation: 'get'`, donnent une URL que le navigateur récupère directement.
  La doc la recommande pour « Embed a private blob in a server-rendered page
  without proxying bytes through your function ». Expiration par défaut :
  1 heure ; maximum : 7 jours ; la validité de chaque URL est bornée par celle du
  jeton [vercel-blob-signed]. Ces lectures passent par le cache CDN
  [vercel-blob-signed].

**Ce qui n'est pas documenté.**

- La révocation d'une URL signée avant son expiration n'est pas décrite. Supprimer
  ou remplacer un blob « may take up to 60 seconds to propagate through our
  cache » [vercel-blob].
- La facturation d'une lecture par URL signée n'est pas énoncée. La doc décrit
  seulement la lecture privée par une fonction et la lecture publique directe
  (« Blob Data Transfer + Fast Origin Transfer on cache miss »)
  [vercel-blob-pricing]. Que la lecture signée se facture comme la lecture
  publique est une déduction.

**Prix.**

| Poste | Hobby (inclus) | Pro |
| --- | --- | --- |
| Stockage | 1 Go | 0,023 $ (iad1) à 0,024 $ (cdg1) par Go-mois |
| Opérations simples (lecture sur miss, `head()`) | 10 000 | 0,40 à 0,42 $ par million |
| Opérations avancées (`put()`, `copy()`, `list()`) | 2 000 | 5,00 à 5,30 $ par million |
| Blob Data Transfer | 10 Go | couvert par Flat Rate CDN, sinon 0,05 $ par Go |

Sources du tableau : [vercel-blob-pricing] [vercel-cdg1] [vercel-iad1]
[vercel-flat].

Les HIT ne comptent ni comme opération simple, ni en Fast Origin Transfer ;
`del()` est gratuit [vercel-blob-pricing]. Sur Hobby, « you will not be able to
access Vercel Blob if limits are exceeded » pendant 30 jours
[vercel-blob-pricing]. Débits maximaux sur Hobby : 20 opérations simples et
15 opérations avancées par seconde [vercel-blob-pricing]. Le cache CDN garde un
blob jusqu'à un mois par défaut (`cacheControlMaxAge`) [vercel-blob].

## 5. Cloudflare R2 (option C)

| Poste | Standard | Infrequent Access |
| --- | --- | --- |
| Stockage | 0,015 $ par Go-mois | 0,01 $ par Go-mois, 30 jours minimum |
| Classe A (écritures, `PutObject`, `ListObjects`…) | 4,50 $ par million | 9,00 $ par million |
| Classe B (lectures, `GetObject`, `HeadObject`…) | 0,36 $ par million | 0,90 $ par million |
| Récupération | — | 0,01 $ par Go |
| Egress | **gratuit** : « no charges for egress bandwidth for any storage class » | idem |

Le palier gratuit est mensuel et ne vaut que pour Standard : 10 Go-mois de
stockage, 1 million d'opérations de classe A et 10 millions de classe B.
`DeleteObject` est gratuit. Une requête non autorisée reçoit une 401 et n'est pas
facturée [r2-pricing].

**URL présignées.** `GET`, `HEAD`, `PUT` et `DELETE`, avec une durée de vie de
1 seconde à 7 jours (604 800 s). Elles fonctionnent sur le domaine de l'API S3
(`<ACCOUNT_ID>.r2.cloudflarestorage.com`) et « cannot be used with custom
domains ». Pour authentifier sur un domaine personnalisé, la doc renvoie à la
validation HMAC du WAF, qui « requires Pro plan or above » [r2-presigned]. La
révocation avant expiration n'est pas documentée. Pour un usage navigateur, la
doc conseille des règles CORS sur le bucket [r2-presigned] ; elles seront
nécessaires si un Son est chargé par `fetch()`.

**Compatibilité S3.** L'endpoint est `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
avec la région `auto` (`us-east-1` ou une valeur vide y renvoient). `GetObject`,
`PutObject`, `HeadObject`, `DeleteObject`, `CopyObject`, `ListObjectsV2` et le
multipart sont pris en charge. Ne le sont pas : ACL, versioning, Object Lock,
tagging, SSE-KMS (seul SSE-C l'est) et politiques de bucket [r2-s3].

## 6. AWS S3 (option C)

Prix lus dans les fichiers de l'AWS Price List API, publiés le 2026-09-28 pour
S3 et le 2026-09-16 pour le transfert de données [aws-s3-euw3] [aws-s3-euc1]
[aws-dt-euw3] [aws-dt-euc1]. La page de prix publique ne rend pas ses tableaux en texte
[aws-s3-pricing].

| Poste | Paris (eu-west-3) | Francfort (eu-central-1) |
| --- | --- | --- |
| S3 Standard, 50 premiers To | 0,024 $ par Go-mois | 0,0245 $ par Go-mois |
| PUT, COPY, POST, LIST | 0,0053 $ les 1 000 | 0,0054 $ les 1 000 |
| GET et autres | 0,0042 $ les 10 000 (0,00042 $ les 1 000) | 0,0043 $ les 10 000 |
| Sortie vers Internet | 100 premiers Go par mois gratuits, « aggregated globally » sur tous les services AWS, puis 0,09 $ par Go jusqu'à 10 To | idem |
| Sortie vers CloudFront | gratuite | gratuite |

Palier gratuit : depuis le 2025-07-15, un nouveau compte reçoit jusqu'à 200 $ de
crédits, avec une offre gratuite de 6 mois et des crédits à consommer dans les
12 mois [aws-s3-pricing]. Les 100 Go de sortie gratuits par mois sont
permanents [aws-s3-pricing] [aws-dt-euw3].

**URL présignées.** Valides jusqu'à 7 jours si elles sont signées en SigV4 par un
utilisateur IAM. Signées avec des identifiants temporaires (rôle, STS), elles
expirent avec eux, soit 1 h par défaut pour AssumeRole [aws-presigned]. Il existe
deux moyens de révoquer : désactiver les identifiants qui ont signé, ce qui
révoque toutes les URL signées avec eux (« a presigned URL expires when the
credential you used to create it is revoked, deleted, or deactivated »), ou
poser une politique de bucket sur `s3:signatureAge` [aws-presigned].

## 7. Ce que chaque option change à la dépublication

ADR 0069 et le commentaire de la route média posent la règle : « nothing it
served may outlive the Publish ». Voici comment chaque option s'en approche.

| Option | Après une dépublication |
| --- | --- |
| A | rien n'a été mis en cache : la règle tient telle qu'aujourd'hui |
| B | `dangerouslyDeleteByTag` sur le tag du Récit ; délai de propagation non documenté ; à éviter : `invalidateByTag`, qui sert encore l'ancienne réponse une fois |
| C R2 | une URL déjà émise reste valable jusqu'à son expiration (révocation non documentée) ; supprimer l'objet coupe l'accès |
| C S3 | idem, plus la révocation globale par désactivation des identifiants signataires |
| D | une URL signée reste valable jusqu'à son expiration ; supprimer le blob coupe l'accès, avec jusqu'à 60 s de propagation dans le cache |

Les octets d'une édition sont adressés par leur empreinte (`digest`), donc
immuables. C'est ce qui rend B et D compatibles avec un cache long : une
nouvelle édition produit de nouvelles URL.

## 8. Comparaison chiffrée

Deux audiences, prises de l'énoncé :

- **M1** : 600 Lectures complètes par mois d'un Récit de 40 Images, soit
  24 000 requêtes média et environ 5 Go.
- **M2** : dix fois plus, soit 240 000 requêtes et environ 50 Go.

Hypothèses : moins de 1 Go de médias stockés, donc un stockage négligeable
partout ; trafic européen ; pas de remise.

**Socle commun à toutes les options :**

- *Vercel.* Si Frameline relève de l'usage commercial au sens de la section 2,
  Pro à 20 $ par mois s'impose quelle que soit l'option, et les postes Vercel
  ci-dessous tiennent dans les 20 $ de crédit.
- *Neon, calcul.* Le calcul dépend du temps d'éveil, pas des médias. Free couvre
  100 CU-h, soit environ 400 h à 0,25 CU. Un calcul éveillé en permanence en
  demande 182,5, soit environ 19 $ sur Launch. Avec un scale-to-zero à 5 min, les
  600 Lectures de M1 dispersées dans le mois tiennent vraisemblablement sous
  100 CU-h. Les 6 000 de M2 approchent un éveil continu et peuvent épuiser le
  calcul de Free **même sans aucun média en base**. C'est une estimation, pas une
  mesure.

**Coût propre aux médias, par mois :**

| | M1 (5 Go) | M2 (50 Go) |
| --- | --- | --- |
| **A** Neon Launch, octets en base, sans CDN | Neon : 5 Go d'egress (10 Go si l'hypothèse hex se vérifie), inclus dans les 500 Go, mais Launch facture le calcul dès la première heure, de 3 à 20 $ selon l'éveil. Vercel Hobby tient : 5 Go de Fast Origin Transfer sur 10 inclus. **≈ 3 à 20 $** | Neon ≈ 20 $. Vercel : 50 Go de Fast Origin Transfer dépassent les 10 Go de Hobby, d'où Pro (3 $ de Fast Origin Transfer dans le crédit). **≈ 40 $** |
| **B** octets en base, CDN Vercel, purge par tag | les misses seuls touchent Neon et la fonction (40 Images × quelques régions × déploiements du mois, quelques dizaines de Mo) ; 5 Go de Fast Data Transfer sur les 100 de Hobby ; Neon Free suffit si les médias restent sous 1 Go de stockage. **≈ 0 $** | Hobby tient encore : 50 Go de Fast Data Transfer sur 100, 240 000 requêtes sur 1 million, Fast Origin Transfer proche de zéro. **≈ 0 $** pour les médias ; sur Pro, ils tiennent dans Flat Rate, sous réserve de la clause sur les médias |
| **C** R2 + URL présignées | 24 000 lectures de classe B sur 10 millions gratuites, egress gratuit. **0 $** | 240 000 lectures de classe B, toujours dans le gratuit. **0 $** |
| **C** S3 Paris + URL présignées | GET 0,01 $, egress dans les 100 Go gratuits. **≈ 0,03 $** | GET 0,10 $, egress toujours dans les 100 Go. **≈ 0,15 $** ; à 500 Go, l'egress coûterait environ 36 $ |
| **D** Vercel Blob privé, URL signées | 5 Go de Blob Data Transfer sur les 10 de Hobby. **0 $** | 50 Go de Blob Data Transfer dépassent les 10 de Hobby, d'où Pro : Flat Rate, ou 0,05 $ par Go, soit 2,50 $ dans le crédit. **≈ 20 $** (le socle Pro) |
| **D** Vercel Blob privé, lu par une fonction | Blob Data Transfer, Fast Origin Transfer et Fast Data Transfer de 5 Go chacun, dans les quotas Hobby | dépasse Hobby sur deux postes ; sur Pro, environ 3 $ de Fast Origin Transfer dans le crédit. **≈ 20 $** |

Ce que le tableau montre :

- **A** paie le calcul Neon pour garder un schéma qui fait transiter chaque octet
  par la base, par une fonction et deux fois par la facturation Vercel. C'est la
  seule option où les médias suffisent à imposer un plan payant dès M1.
- **B** rend le transfert presque nul sans déplacer un octet. Il reste trois
  conditions : vérifier que `no-store` côté navigateur n'empêche pas le cache CDN,
  supprimer plutôt qu'invalider à la dépublication, et garder les médias sous
  1 Go de stockage sur Neon Free (les octets d'une édition s'y ajoutent à ceux
  des Plans). Sur Pro, la clause médias de Flat Rate CDN est un risque, pas un
  prix.
- **C** avec R2 est gratuit aux deux tailles et sort entièrement les médias de
  Vercel et de Neon. Le prix : des URL présignées sur le domaine
  `r2.cloudflarestorage.com`, sans CDN devant, valables jusqu'à leur expiration.
- **D** coûte peu en Pro et rien en Hobby jusqu'à 10 Go de Blob Data Transfer.
  Deux points ne sont pas documentés : la révocation d'une URL signée et la
  facturation exacte d'une lecture signée.

## 9. Trous — ce qui n'a pas pu être vérifié en source primaire

- **Vercel, `no-store` et `Vercel-CDN-Cache-Control` ensemble.** La priorité des
  en-têtes et la règle « pas de `no-store` dans `Cache-Control` » sont écrites
  sur deux pages qui ne se répondent pas. À trancher par un essai, en lisant
  `x-vercel-cache`.
- **Vercel, délai de propagation d'une purge par tag.** Ni la doc, ni les
  changelogs, ni la référence REST ne le donnent. Aucune limite de débit n'est
  publiée pour l'API de purge.
- **Vercel, requêtes CDN incluses en Pro.** 10 millions sur la page de prix,
  1 million dans la doc.
- **Vercel, prix de Flex CDN** et seuil exact au-delà duquel des médias
  « constitute a majority of bandwidth usage ».
- **Vercel, plan et région du projet.** Le plan du compte n'a pas été lu (l'API
  utilisée ne l'expose pas). La région n'est pas fixée dans `vercel.json`, donc
  `iad1` par défaut ; le réglage du tableau de bord n'a pas été vérifié.
- **Vercel Blob.** Facturation d'une lecture par URL signée (déduite de la
  lecture publique) ; révocation d'une URL signée avant expiration.
- **Neon.** Redémarrage nécessaire ou non après la montée de plan d'un calcul
  suspendu (pages contradictoires) ; période de facturation calendaire ou
  anniversaire ; taille minimale de calcul sur Launch (0,25 CU n'apparaît que dans
  des exemples) ; conditions du lien « Claim $20 in free credits », non lues.
- **Neon, encodage des `bytea` par `neon-http`.** Le doublement hex est une
  hypothèse tirée de la doc PostgreSQL ; la doc du pilote ne dit rien de
  l'encodage ni de la compression. La console Neon permettra de mesurer l'egress
  par Lecture une fois le calcul revenu.
- **Cloudflare R2.** Révocation d'une URL présignée avant expiration ; éventuelle
  mise en cache des lectures faites par l'endpoint S3.
- **Temps d'éveil réel du calcul Neon** aux deux audiences : les fourchettes de
  la section 8 sont des estimations fondées sur le scale-to-zero à 5 min.

## Sources

[neon-pricing]: https://neon.com/pricing
[neon-plans]: https://neon.com/docs/introduction/plans
[neon-transfer]: https://neon.com/docs/introduction/network-transfer
[neon-faq]: https://neon.com/faqs/free-plan-limits-and-quotas
[neon-billing]: https://neon.com/docs/introduction/manage-billing
[neon-stz]: https://neon.com/docs/introduction/scale-to-zero
[neon-storage]: https://neon.com/docs/storage/overview
[neon-driver]: https://neon.com/docs/serverless/serverless-driver
[pg-bytea]: https://www.postgresql.org/docs/current/datatype-binary.html
[vercel-price]: https://vercel.com/pricing
[vercel-pricing]: https://vercel.com/docs/pricing
[vercel-hobby]: https://vercel.com/docs/plans/hobby
[vercel-pro]: https://vercel.com/docs/plans/pro-plan
[vercel-flat]: https://vercel.com/docs/pricing/flat-rate-cdn
[vercel-cdn]: https://vercel.com/docs/cdn
[vercel-cdg1]: https://vercel.com/docs/pricing/regional-pricing/cdg1
[vercel-iad1]: https://vercel.com/docs/pricing/regional-pricing/iad1
[vercel-functions]: https://vercel.com/docs/functions/usage-and-pricing
[vercel-region]: https://vercel.com/docs/functions/configuring-functions/region
[vercel-cdn-usage]: https://vercel.com/docs/manage-cdn-usage
[vercel-fair]: https://vercel.com/docs/limits/fair-use-guidelines
[vercel-cdn-cache]: https://vercel.com/docs/caching/cdn-cache
[vercel-cc]: https://vercel.com/docs/caching/cache-control-headers
[vercel-kb-cc]: https://vercel.com/kb/guide/set-cache-control-headers
[vercel-purge]: https://vercel.com/docs/caching/cdn-cache/purge
[vercel-status]: https://vercel.com/docs/caching/cache-status
[vercel-rest-purge]: https://vercel.com/docs/rest-api/edge-cache/invalidate-by-tag
[vercel-cl-purge]: https://vercel.com/changelog/invalidate-the-cdn-cache-by-tag
[vercel-cl-tags]: https://vercel.com/changelog/tag-based-cache-invalidation-now-available-for-all-responses
[vercel-blob]: https://vercel.com/docs/vercel-blob
[vercel-blob-private]: https://vercel.com/docs/vercel-blob/private-storage
[vercel-blob-signed]: https://vercel.com/docs/vercel-blob/vercel-signed-urls
[vercel-blob-pricing]: https://vercel.com/docs/vercel-blob/usage-and-pricing
[vercel-cl-blob]: https://vercel.com/changelog/vercel-private-blob-is-now-generally-available
[r2-pricing]: https://developers.cloudflare.com/r2/pricing/
[r2-presigned]: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
[r2-s3]: https://developers.cloudflare.com/r2/api/s3/api/
[aws-s3-pricing]: https://aws.amazon.com/s3/pricing/
[aws-s3-euw3]: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/eu-west-3/index.json
[aws-s3-euc1]: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/eu-central-1/index.json
[aws-dt-euw3]: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/eu-west-3/index.json
[aws-dt-euc1]: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/eu-central-1/index.json
[aws-presigned]: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html

- Neon : [prix][neon-pricing], [plans][neon-plans], [transfert réseau][neon-transfer],
  [FAQ du plan Free][neon-faq], [facturation][neon-billing],
  [scale-to-zero][neon-stz], [Object Storage][neon-storage],
  [pilote serverless][neon-driver].
- PostgreSQL : [types binaires][pg-bytea].
- Vercel : [prix][vercel-price], [tarification][vercel-pricing], [Hobby][vercel-hobby],
  [Pro][vercel-pro], [Flat Rate CDN][vercel-flat], [CDN][vercel-cdn],
  [prix cdg1][vercel-cdg1], [prix iad1][vercel-iad1],
  [fonctions][vercel-functions], [régions][vercel-region],
  [usage CDN][vercel-cdn-usage], [fair use][vercel-fair],
  [cache CDN][vercel-cdn-cache], [en-têtes de cache][vercel-cc],
  [guide en-têtes][vercel-kb-cc], [purge][vercel-purge],
  [statuts de cache][vercel-status], [API de purge][vercel-rest-purge],
  changelogs [purge par tag][vercel-cl-purge], [tags pour toutes les réponses][vercel-cl-tags],
  [Blob privé GA][vercel-cl-blob] ; Blob : [vue d'ensemble][vercel-blob],
  [stockage privé][vercel-blob-private], [URL signées][vercel-blob-signed],
  [prix][vercel-blob-pricing].
- Cloudflare R2 : [prix][r2-pricing], [URL présignées][r2-presigned],
  [compatibilité S3][r2-s3].
- AWS : [page de prix S3][aws-s3-pricing], Price List API
  [S3 eu-west-3][aws-s3-euw3], [S3 eu-central-1][aws-s3-euc1],
  [transfert eu-west-3][aws-dt-euw3], [transfert eu-central-1][aws-dt-euc1], [URL présignées][aws-presigned].

## Compléments R2 et crons (2026-10-11)

Complément du même jour, écrit après le choix de l'option C avec R2 : un bucket
privé, des URL présignées d'environ 5 minutes que notre fonction Vercel (Hobby)
émet après le contrôle d'accès et renvoie par une redirection 302, et des envois
qui passent toujours par la fonction avant d'être écrits dans R2. Contrainte :
aucune facture mensuelle. La règle des sources est la même que plus haut. Les
mesures faites pour cette note sont signalées comme telles, et les liens sont
en fin de section.

### Facturation R2 : moyen de paiement, dépassement, plafond

**Moyen de paiement.** Activer R2, c'est souscrire un abonnement : « You need a
Cloudflare account with an R2 subscription », puis « Complete the checkout flow
to add an R2 subscription to your account » [r2-start]. Cette page ne parle pas
de moyen de paiement, mais la politique de facturation, si : « Ensure that you
are using a valid payment method before changing your plan type or enabling
subscriptions », et, pour les services facturés à l'usage, « Cloudflare may
preauthorize your credit card at any point in a billing period » [cf-policy]. Il
faut donc s'attendre à enregistrer une carte ou un compte PayPal même pour
rester dans le gratuit. C'est une déduction : aucune page ne le dit de R2 en ces
termes. Une carte prépayée n'est pas une parade fiable : « Gift cards and
pre-payment cards may not be accepted » [cf-policy].

**Au-delà du gratuit : facturé, pas bloqué.** « You are billed for your usage on
a monthly basis » [r2-start] ; « you are only charged for usage that exceeds the
included amount », à terme échu [cf-usage]. Les exemples de la page de prix
facturent le dépassement (290 millions d'opérations de classe B au-delà du
gratuit, 104,40 $), et l'usage est arrondi à l'unité supérieure : « If you have
performed one million and one operations, you will be billed for two million
operations » [r2-pricing]. Aucune page lue ne décrit de blocage au palier
gratuit. Le seul arrêt documenté est l'échec de paiement : « you will not be
able to access your R2 buckets and requests will return errors, but your data
will remain secure », et sans moyen de paiement valide sous 30 jours, les
données « may be deleted » [cf-policy].

**Plafond : aucun. Alertes : oui, informatives seulement.**

- *Budget alerts*, depuis avril 2026 : réservées aux comptes Pay-as-you-go, avec
  un seuil en dollars sur tout le compte, « all usage-based products combined ».
  « Budget alerts are informational only. They do not pause or cap usage »
  [cf-budget]. Le seuil doit être strictement positif [cf-budget-cl] : une alerte
  à 0,01 $ prévient dès le premier centime.
- Depuis le 2026-06-15, Cloudflare crée d'office une alerte à 10 $ sur les
  comptes Pay-as-you-go éligibles qui n'en ont pas, active à partir du cycle
  suivant ; elle « does not cap your usage ». L'usage est traité une fois par
  jour, donc l'alerte part le lendemain du franchissement [cf-budget-default].
- *Contradiction* : le changelog de lancement parle de dépense *projetée* sur le
  mois [cf-budget-cl], la doc de dépense *cumulée* sur la période [cf-budget].
- Les notifications d'usage par produit (octets, requêtes) demandent « a
  Professional plan or higher » [cf-usage] : un compte gratuit n'y a pas accès.

**Limiter un bucket.** Aucune des pages R2 lues (prix, limites, compatibilité
S3, CORS, URL présignées) ne décrit de quota par bucket ni de refus au-delà d'un
seuil. Le plafond est donc à tenir dans l'application, et l'architecture retenue
le permet (déduction). Chaque envoi passe par notre fonction, qui connaît la
taille de ce qu'elle écrit et peut refuser au-delà d'un total stocké. Chaque
lecture passe aussi par elle le temps de la 302, et elle peut compter les URL
qu'elle émet. Ce compte a une limite : une URL présignée est un jeton au
porteur, et « The same presigned URL can be reused multiple times until it
expires » [r2-presigned]. On compte donc des émissions, pas des `GET`. Hobby
plafonne les invocations à 1 million par mois puis coupe (section 2), ce qui
borne les émissions bien en dessous des 10 millions de lectures gratuites. Mais
une URL rejouée en boucle pendant ses 5 minutes produit des `GET` sans repasser
par la fonction, et aucune limite de débit de l'endpoint S3 n'est publiée. À
0,36 $ le million, 10 millions de lectures en trop coûteraient 3,60 $.

### Une lecture présignée est une opération de classe B

`GetObject` et `HeadObject` sont de classe B [r2-pricing]. Une URL présignée
`GET` est signée à partir d'un `GetObjectCommand` [r2-presigned], et c'est ce
`GetObject` qu'elle exécute : elle compte en classe B. La page des URL
présignées ne parle pas de facturation ; c'est une déduction, mais aucune autre
lecture n'est plausible.

Requêtes en échec : « You are not charged for operations when the caller does
not have permission to make the request (HTTP 401 Unauthorized response status
code) » [r2-pricing]. Or une URL expirée reçoit « a 403 ExpiredRequest
response » [r2-cors], et une URL altérée « a 403/SignatureDoesNotMatch error »
[r2-presigned]. La page de prix ne parle que de la 401 : **la facturation d'une
403 n'est pas documentée**. Aux volumes de la section 8, l'enjeu est nul.

### CORS et redirection 302

**Ce qui a besoin de CORS dans Frameline.** Une Image est préchargée par
`new Image()` sans attribut `crossOrigin` (`app/utils/brought.ts`), donc en mode
`no-cors` : « The attribute's missing value default is the No CORS state »
[html-cors]. Elle n'a besoin d'aucune règle CORS. Un Son est chargé par
`fetch(src)`, en mode `cors` : lui en a besoin.

**Ce que fait le navigateur.** `fetch()` suit la 302 de lui-même. Ce qui compte
ensuite, c'est l'en-tête `Origin` de la requête envoyée à R2. Il vaut `null` si
la *redirect-taint* de la requête n'est pas « same-origin » [fetch], et cette
teinte ne se dégrade que si la chaîne passe par une origine autre que celle de
la page. Ici, la chaîne part de notre origine et va directement chez R2 : la
teinte reste « same-origin », et R2 reçoit `Origin: https://<notre domaine>`.
Une règle qui nomme notre origine suffit, inutile d'autoriser `null`. La
redirection a deux autres effets. Le navigateur retire `Authorization` : « the
moment another origin is seen after the initial request, the `Authorization`
header is removed » [fetch]. Et le cookie de session part sur le premier saut,
qui est de même origine, mais pas chez R2, puisque le mode de credentials par
défaut de `fetch()` est `same-origin` [fetch]. Le contrôle d'accès de la route
fonctionne donc tel quel.

**Règles pratiques.**

- Garder le `fetch` simple, sans en-tête personnalisé. Sinon, le navigateur
  envoie un preflight `OPTIONS` à R2 après la redirection, et la règle doit
  lister l'en-tête dans `AllowedHeaders`.
- Ne pas passer `credentials: 'include'` : la doc R2 ne dit rien de
  `Access-Control-Allow-Credentials` [r2-cors].
- R2 n'ajoute les en-têtes CORS que si la requête porte un `Origin` qui
  correspond à une règle. Pour tester avec `curl`, il faut ajouter cet en-tête à
  la main [r2-cors].
- Une URL expirée reçoit une 403 **sans en-têtes CORS** : « browser JavaScript
  cannot read the error body » [r2-cors]. Le `fetch` échoue alors comme une
  erreur réseau. `bringSoundIn` le rattrape déjà et redemande l'adresse de notre
  route au prochain appel, ce qui produit une nouvelle 302.
- Recommandation, sans source : émettre la 302 avec `Cache-Control: no-store`,
  pour qu'aucun cache ne rejoue une redirection vers une URL expirée.

**Format de la politique.** Dans le tableau de bord (onglet JSON) comme par
l'API S3, c'est un tableau de règles à cinq champs : `AllowedOrigins`,
`AllowedMethods`, `AllowedHeaders`, `ExposeHeaders` et `MaxAgeSeconds`, ce
dernier à 86 400 au plus [r2-cors]. `PutBucketCors` est implémenté [r2-s3] :
un script peut poser la politique. Pour Frameline :

```json
[{ "AllowedOrigins": ["https://<domaine de production>"], "AllowedMethods": ["GET", "HEAD"], "MaxAgeSeconds": 3600 }]
```

Wrangler prend un autre format, appliqué par
`npx wrangler r2 bucket cors set <BUCKET> --file cors.json` [r2-cors] :

```json
{ "rules": [{ "allowed": { "origins": ["https://<domaine de production>"], "methods": ["GET", "HEAD"] } }] }
```

Contraintes sur les origines : correspondance exacte, sans chemin ni `/` final ;
un seul `*` par motif, qui peut couvrir plusieurs niveaux de domaine ; pas de
joker sur un port. Un changement peut mettre jusqu'à 30 s à se propager
[r2-cors]. `vercel.json` ne déploie que `main` : il n'y a qu'une origine de
production à nommer.

### En-têtes de réponse

**Surcharges `response-*`.** La ligne `GetObject` de la page de compatibilité
S3 liste les en-têtes conditionnels, `Range`, `PartNumber` et SSE-C. Elle ne
range `response-content-type`, `response-cache-control` et
`response-content-disposition` ni parmi les paramètres pris en charge, ni parmi
les refusés [r2-s3], et la page des URL présignées n'en dit rien
[r2-presigned]. **Non documenté** : mieux vaut ne pas s'en servir.

**Métadonnées posées à l'envoi.** `PutObject` prend en charge `Content-Type`,
`Cache-Control`, `Content-Disposition`, `Content-Encoding`, `Content-Language`
et `Expires` [r2-s3]. C'est la voie à suivre : la fonction qui écrit pose le
type qu'elle a validé. Sans `Content-Type`, R2 le devine : « Uploads will
automatically infer the Content-Type based on file body if one is not
explicitly set » (note de version du 2022-08-06) [r2-notes].

**`X-Content-Type-Options: nosniff`.** Aucune page R2 lue ne décrit de moyen
d'ajouter un en-tête arbitraire aux réponses de l'endpoint S3, et les URL
présignées « cannot be used with custom domains » [r2-presigned]. Que R2 envoie
`nosniff` de lui-même n'est pas documenté : un `curl -sI` sur la première URL
présignée le dira. Le risque est borné (déduction) : la réponse vient de
`<ACCOUNT_ID>.r2.cloudflarestorage.com`, une autre origine que Frameline. Un
contenu lu comme du HTML s'y exécuterait sans accès aux cookies ni au DOM de
Frameline.

**`Cache-Control` et URL changeantes.** Chaque URL émise porte `X-Amz-Date` et
`X-Amz-Signature` dans sa query string (constaté sur des URL générées avec les
deux clients de la sous-section suivante). Le cache du navigateur est indexé par
URL : deux émissions pour la même Image ne partagent rien, et un `Cache-Control`
posé sur l'objet ne sert qu'aux réutilisations d'une même URL. Piste à tester :
fixer la date de signature au début d'une fenêtre (`signingDate` de
`getSignedUrl`, `datetime` d'aws4fetch [aws4fetch]) pour que toutes les
émissions d'une fenêtre donnent la même URL. La validité court depuis la date de
signature, donc elle doit couvrir la fenêtre plus une marge.

### Emplacement et juridiction

- *Location hints* : `wnam`, `enam`, `weur`, `eeur`, `apac` et `oc`, « a best
  effort and not a guarantee ». Un hint n'est pris en compte qu'à la première
  création d'un bucket d'un nom donné. Il se pose dans le tableau de bord ou par
  `LocationConstraint` [r2-location]. Pour un trafic européen : `weur`.
- *Juridictions* : `eu`, `us` et `fedramp`, la dernière réservée aux clients
  Enterprise. « Jurisdictional Restrictions guarantee objects in a bucket are
  stored within a specific jurisdiction », avec le RGPD en exemple. Endpoint :
  `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`. La juridiction se choisit à
  la création et ne change plus, et Logpush ne voit pas ces buckets
  [r2-location].
- *Prix* : ni la page de prix ni celle des emplacements ne mentionnent de
  supplément pour une juridiction ou un hint [r2-pricing] [r2-location]. C'est
  un silence, pas une promesse de gratuité.
- *Endpoint des URL présignées* : c'est le domaine de l'API S3, jamais un domaine
  personnalisé [r2-presigned]. Pour un bucket `eu`, c'est donc
  `<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`, puisque cet endpoint sert toutes
  les opérations S3 sur ce bucket (déduction).

### Client S3 depuis Node

Cloudflare documente deux clients JavaScript. Le premier est
`@aws-sdk/client-s3`, avec `getSignedUrl` de `@aws-sdk/s3-request-presigner` et
`region: "auto"`, « Required by SDK but not used by R2 » [r2-presigned]
[r2-sdk]. Le second est `aws4fetch`, qui signe une URL avec `signQuery: true` et
`X-Amz-Expires` [r2-aws4fetch].

Mesure faite pour cette note : un module qui envoie, supprime et présigne une
lecture, empaqueté par esbuild 0.25.10 (`--platform=node --minify`).

| Client | Version | Minifié | gzip | Autres faits |
| --- | --- | --- | --- | --- |
| `@aws-sdk/client-s3` + `s3-request-presigner` | 3.1149.0 | 568 398 octets | 167 276 octets | Node ≥ 20 ; 3,3 Mo décompressé |
| `aws4fetch` | 1.0.20 | 7 879 octets | 3 177 octets | aucune dépendance ; dernière publication le 2024-08-28 |

Sources du tableau : le registre npm [npm-sdk] [npm-aws4fetch]. Le README
d'aws4fetch annonce « 6.4kb minified, 2.5kb gzipped » pour la bibliothèque seule
[aws4fetch].

`aws4fetch` repose sur `fetch` et `SubtleCrypto` [aws4fetch]. La page Cloudflare
ne parle pas de Node, mais l'URL présignée a été produite sans erreur sous
Node 22.23 en local. C'est le client minimal, et il couvre les trois opérations
dont Frameline a besoin sur des objets de 2 Mo au plus. Le SDK ajoute le
multipart, les nouvelles tentatives et les erreurs typées.

**Checksums.** La page R2 du SDK v3, mise à jour le 2026-04-21, ne donne aucun
avertissement sur les checksums [r2-sdk]. La page de compatibilité accepte
CRC-64/NVME en `FULL_OBJECT`, et CRC32, CRC32C, SHA-1 et SHA-256 en `COMPOSITE`
seulement [r2-s3]. Si un `PutObject` du SDK échoue sur un checksum, l'option
client `requestChecksumCalculation: "WHEN_REQUIRED"` existe dans 3.1149.0.
aws4fetch n'envoie aucun en-tête `x-amz-checksum-*` (lu dans son code).

### Crons Vercel sur Hobby

| | Hobby |
| --- | --- |
| Nombre | 100 par projet, comme Pro et Enterprise |
| Intervalle minimal | une fois par jour. Une expression plus fréquente fait échouer le déploiement : « Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day. » |
| Précision | à l'heure : `0 1 * * *` part entre 1 h 00 et 1 h 59 |
| Fuseau | UTC, toujours |
| Prix | une invocation de fonction ordinaire, dans les quotas des fonctions |

Sources du tableau : [vercel-cron-usage] [vercel-cron].

Fonctionnement [vercel-cron] [vercel-cron-start] [vercel-cron-manage] :

- un `GET` vers le déploiement de **production** seulement, jamais une preview,
  avec l'agent `vercel-cron/1.0` et l'en-tête `x-vercel-cron-schedule` ;
- pas de noms (`MON`, `JAN`), et le jour du mois ou le jour de la semaine, pas
  les deux ;
- aucune nouvelle tentative en cas d'échec, et une redirection vaut réponse
  finale ;
- livraison « best effort » : une exécution peut manquer, sans log, ou arriver
  deux fois. Vercel recommande des opérations idempotentes qui rattrapent tout
  le travail en attente depuis le dernier succès ;
- durée maximale : celle d'une fonction.

**Protection.** On ajoute au projet la variable `CRON_SECRET`, « a random string
of at least 16 characters ». Vercel l'envoie en `Authorization: Bearer
<CRON_SECRET>`, et la route compare. L'exemple de Vercel refuse aussi quand la
variable manque : il renvoie 401 si
`` !cronSecret || authHeader !== `Bearer ${cronSecret}` `` [vercel-cron-manage].

**Déclaration dans Frameline (Nuxt 4.5, nitropack 2.13.4 installé).**

- *`crons` dans `vercel.json`*, la voie que Vercel documente :
  `"crons": [{ "path": "/api/…", "schedule": "0 3 * * *" }]`, avec un `path` qui
  commence par `/` [vercel-cron-start]. Le fichier existe déjà.
- *`nitro.vercel.config.crons`* dans `nuxt.config.ts`. Nitro 2 fusionne
  `vercel.config` dans la configuration qu'il génère [nitro2-vercel], et le
  `config.json` du Build Output API accepte `crons` [vercel-boa]. Le code
  installé le confirme : `defu(nitro.options.vercel?.config, …)`.
- *Tâches planifiées de Nitro.* La doc Nitro décrit une conversion automatique
  de `scheduledTasks` en crons Vercel, servis par `/_vercel/cron`, qui ne
  vérifie `CRON_SECRET` que s'il est défini : « `CRON_SECRET` is **not** set by
  default » [nitro-vercel]. Mais cette page documente Nitro v3
  (`import { defineConfig } from "nitro"`), et le preset `vercel` de nitropack
  2.13.4, lu dans `node_modules`, ne contient aucun code de cron. **Dans
  Frameline aujourd'hui, `scheduledTasks` ne créerait aucun cron Vercel.**
- Les pages lues ne disent pas si Vercel fusionne les `crons` de `vercel.json`
  avec le Build Output que produit Nitro. Elles disent seulement que les crons
  s'ajoutent « through `vercel.json` or the Build Output API » [vercel-cron].
  C'est à vérifier dans *Settings › Cron Jobs* après le premier déploiement
  [vercel-cron-manage].

### MinIO pour la CI et le développement

**Distribution.** Le dépôt `minio/minio` est archivé, avec un dernier push le
2026-04-24. Son README s'ouvre sur « THIS REPOSITORY IS NO LONGER MAINTAINED »
et renvoie vers AIStor Free et AIStor Enterprise. Il dit aussi : « The MinIO
community edition is now distributed as source code only. We will no longer
provide pre-compiled binary releases for the community version », et les
binaires historiques « will not receive updates » [minio]. Licence : AGPLv3
[minio]. Dernière release GitHub : `RELEASE.2025-10-15T17-29-55Z`, publiée le
2025-10-16 [minio-releases].

**L'image Docker.** Mesure faite le 2026-10-11 : l'API de Docker Hub répond 404
pour le dépôt `minio/minio` [dockerhub-minio], et le registre refuse le pull
anonyme (401, quand `library/alpine` répond 200). L'image `minio/minio` n'est
plus tirable publiquement. Aucune annonce de ce retrait n'a été lue : c'est un
constat. AIStor Free est gratuit, mais demande une clé de licence obtenue sur
`subnet.min.io`, et sa page ne dit pas sous quelle licence il est distribué
[aistor]. Ce serait un secret de plus à gérer en CI, sous des conditions non
lues.

**URL présignées.** Prises en charge : le serveur vérifie les signatures SigV4
passées en query string (`doesPresignedSignatureMatch`) [minio-sigv4].

**CORS : pas comme R2.** `PutBucketCors` est « a dummy api » qui répond
`NotImplemented` [minio-dummy]. Le CORS de MinIO est global, réglé par
`MINIO_API_CORS_ALLOW_ORIGIN`, `*` par défaut [minio-cors-config], et accordé à
toutes les méthodes avec `AllowCredentials: true` [minio-router]. MinIO laisse
donc passer ce que R2 refuserait : une CI sur MinIO ne détecterait pas une
politique CORS fausse sur R2.

Conclusion : archivé et sans image publiée, MinIO n'est plus un choix sain pour
la CI. Une autre émulation S3 locale reste à choisir, hors du champ de cette
note.

### Trous propres à ce complément

- **R2, moyen de paiement pour le seul gratuit.** Déduit de la politique de
  facturation, pas écrit dans la doc R2.
- **R2, facturation d'une 403** (URL expirée ou altérée) : seule la 401 est dite
  gratuite.
- **R2, surcharges `response-*`** sur un `GET` présigné : ni listées, ni
  refusées.
- **R2, `X-Content-Type-Options: nosniff`** sur l'endpoint S3 : non documenté.
- **R2, checksums par défaut du SDK v3 récent** : non testés.
- **Cloudflare, budget alerts** : dépense projetée ou cumulée, selon la page.
- **Vercel, fusion des `crons` de `vercel.json`** avec le Build Output de
  Nitro 2.
- **MinIO, retrait de l'image `minio/minio`** : constaté, sans annonce lue.

### Sources de ce complément

[r2-start]: https://developers.cloudflare.com/r2/get-started/
[r2-cors]: https://developers.cloudflare.com/r2/buckets/cors/
[r2-location]: https://developers.cloudflare.com/r2/reference/data-location/
[r2-notes]: https://developers.cloudflare.com/r2/platform/release-notes/
[r2-sdk]: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
[r2-aws4fetch]: https://developers.cloudflare.com/r2/examples/aws/aws4fetch/
[cf-policy]: https://developers.cloudflare.com/billing/understand/billing-policy/
[cf-usage]: https://developers.cloudflare.com/billing/understand/usage-based-billing/
[cf-budget]: https://developers.cloudflare.com/billing/manage/budget-alerts/
[cf-budget-cl]: https://developers.cloudflare.com/changelog/post/2026-04-13-billable-usage-dashboard-and-budget-alerts/
[cf-budget-default]: https://developers.cloudflare.com/changelog/post/2026-06-15-budget-alerts-default-on/
[fetch]: https://fetch.spec.whatwg.org/
[html-cors]: https://html.spec.whatwg.org/multipage/urls-and-fetching.html#cors-settings-attributes
[aws4fetch]: https://github.com/mhart/aws4fetch
[npm-sdk]: https://www.npmjs.com/package/@aws-sdk/client-s3
[npm-aws4fetch]: https://www.npmjs.com/package/aws4fetch
[vercel-cron]: https://vercel.com/docs/cron-jobs
[vercel-cron-usage]: https://vercel.com/docs/cron-jobs/usage-and-pricing
[vercel-cron-manage]: https://vercel.com/docs/cron-jobs/manage-cron-jobs
[vercel-cron-start]: https://vercel.com/docs/cron-jobs/quickstart
[vercel-boa]: https://vercel.com/docs/build-output-api/configuration
[nitro-vercel]: https://nitro.build/deploy/providers/vercel
[nitro2-vercel]: https://v2.nitro.build/deploy/providers/vercel
[minio]: https://github.com/minio/minio
[minio-releases]: https://github.com/minio/minio/releases
[minio-sigv4]: https://github.com/minio/minio/blob/master/cmd/signature-v4.go
[minio-dummy]: https://github.com/minio/minio/blob/master/cmd/dummy-handlers.go
[minio-cors-config]: https://github.com/minio/minio/blob/master/internal/config/api/api.go
[minio-router]: https://github.com/minio/minio/blob/master/cmd/api-router.go
[aistor]: https://min.io/download
[dockerhub-minio]: https://hub.docker.com/r/minio/minio

- Cloudflare R2 : [démarrage][r2-start], [CORS][r2-cors],
  [emplacement des données][r2-location], [notes de version][r2-notes],
  [SDK v3][r2-sdk], [aws4fetch][r2-aws4fetch] ; et, plus haut, [prix][r2-pricing],
  [URL présignées][r2-presigned], [compatibilité S3][r2-s3].
- Facturation Cloudflare : [politique de facturation][cf-policy],
  [facturation à l'usage][cf-usage], [budget alerts][cf-budget], changelogs
  [lancement][cf-budget-cl] et [alerte par défaut][cf-budget-default].
- Standards du web : [Fetch][fetch], [HTML, attributs CORS][html-cors].
- Clients S3 : [aws4fetch sur GitHub][aws4fetch], npm
  [@aws-sdk/client-s3][npm-sdk] et [aws4fetch][npm-aws4fetch].
- Vercel : [cron jobs][vercel-cron], [usage et prix][vercel-cron-usage],
  [gestion][vercel-cron-manage], [démarrage][vercel-cron-start],
  [Build Output API][vercel-boa].
- Nitro : [Vercel, doc v3][nitro-vercel], [Vercel, doc v2][nitro2-vercel].
- MinIO : [dépôt][minio], [releases][minio-releases],
  [signature v4][minio-sigv4], [CORS factice][minio-dummy],
  [configuration CORS][minio-cors-config], [routeur][minio-router],
  [AIStor Free][aistor], [Docker Hub][dockerhub-minio].

## Émulateur S3 local (2026-10-11)

Complément du même jour, écrit après l'abandon de MinIO (sous-section « MinIO
pour la CI et le développement »). La production écrira les octets dans un
bucket R2 privé avec aws4fetch (SigV4). Le navigateur les lira par une URL
présignée atteinte en 302, et le Son, lu par `fetch()`, a besoin d'une règle
CORS qui nomme notre origine. La suite et `pnpm dev` apportent leurs propres
services dans `compose.yaml` et `compose.dev.yaml`, jamais un compte dans le
cloud (ADR 0075 et 0082). Il faut donc un service S3 en Docker qui accepte ce que
fera la production : une écriture signée, une lecture présignée, et une règle
CORS par bucket que le `GET` applique. La règle des sources est la même que plus
haut. Les mesures faites pour cette note sont signalées comme telles, et les
liens sont en fin de section.

### Méthode des mesures

- *Pull sans compte* : un jeton anonyme demandé au registre (`auth.docker.io`
  pour Docker Hub, `ghcr.io/token` pour GHCR), puis un `HEAD` sur le manifeste du
  tag. Une réponse 200 veut dire que le pull marche sans compte. Témoins :
  `minio/minio` répond 401, `library/alpine` 200. Les images exécutées ont
  ensuite été tirées sans session Docker Hub.
- *Taille* : la somme des couches compressées des manifestes `linux/amd64` et
  `linux/arm64`, lue dans le registre.
- *Comportement* : un script Node 22.23 qui signe avec aws4fetch 1.0.20, le
  client retenu pour la production. Il crée le bucket si besoin et pose une
  règle par `PutBucketCors` : origine `http://localhost:3000`, `GET` et `HEAD`,
  `MaxAgeSeconds` à 3600. Il écrit un objet et présigne un `GET` de 300 s. Puis il
  le lit sans `Origin`, avec notre origine, avec une autre, et en preflight
  `OPTIONS`. Il essaie enfin une signature altérée, une URL expirée et un `GET`
  non signé.
- *Démarrage et mémoire* : du `docker run` à la première réponse HTTP sur le port
  publié, puis `docker stats` après le script. Mesuré sur un Mac Apple Silicon
  (Docker 29.4.0, images arm64) : ce sont des ordres de grandeur, pas des temps
  de CI.

### Distribution

| Candidat | Image | Dernière release | Licence | Pull anonyme | Compressée amd64 / arm64 |
| --- | --- | --- | --- | --- | --- |
| Garage | `dxflrs/garage:v2.4.1` (Docker Hub) [garage-hub] | v2.4.1, 2026-09-08 [garage-rel] | AGPL-3.0 [garage-lic] | 200 | 28 / 26 Mo |
| SeaweedFS | `chrislusf/seaweedfs:4.48` (Docker Hub) | 4.48, 2026-09-28 [sw-rel] | Apache-2.0 [sw] | 200 | 193 / 184 Mo |
| Versity Gateway | `versity/versitygw:v1.8.0` (Docker Hub) | v1.8.0, 2026-09-04 [vgw-rel] | Apache-2.0 [vgw] | 200 | 31 / 29 Mo |
| RustFS | `rustfs/rustfs:1.0.1` (Docker Hub) | 1.0.1, 2026-10-03 [rustfs-rel] | Apache-2.0 [rustfs] | 200 | 111 / 105 Mo |
| Zenko CloudServer | `ghcr.io/scality/cloudserver:9.4.7` [cs-ghcr] | 9.4.7, 2026-10-05 [cs-rel] | Apache-2.0 [cs] | 200 | 259 Mo / pas d'image arm64 |
| LocalStack | `localstack/localstack:4.14.0` (Docker Hub) | v4.14.0, 2026-02-26, la dernière du dépôt ouvert [ls-rel] | Apache-2.0 [ls-license] | 200, mais voir plus bas | 457 / 456 Mo |
| Adobe S3Mock | `adobe/s3mock:5.2.3` (Docker Hub) | 5.2.3, 2026-09-19 [s3mock-rel] | Apache-2.0 [s3mock] | 200 | 84 / 84 Mo |
| rclone `serve s3` | `rclone/rclone:1.75.2` (Docker Hub) | v1.75.2, 2026-10-09 [rclone-rel] | MIT [rclone] | 200 | 34 / 31 Mo |
| Moto, mode serveur | `motoserver/moto:5.2.3` (Docker Hub) | 5.2.3, 2026-08-22 [moto-rel] | Apache-2.0 [moto] | 200 | 99 / 99 Mo |
| S3Proxy | `andrewgaul/s3proxy:s3proxy-4.1.1` (Docker Hub) | 4.1.1, 2026-09-10 [s3proxy-rel] | Apache-2.0 [s3proxy] | 200 | 164 / 162 Mo |
| Miniflare | aucune image : paquet npm `miniflare`, ou `wrangler dev` | 4.20260722.1, 2026-07-28, pour l'endpoint S3 [mf-rel] | MIT [mf-pkg] | sans objet | sans objet |

Licences : le fichier `LICENSE` pour Garage et LocalStack, le champ `license` du
`package.json` pour Miniflare, l'API GitHub pour les autres dépôts. Tous ces
dépôts ont reçu un push depuis le 2026-10-02, sauf LocalStack ; Garage vit sur
la forge de Deuxfleurs, pas sur GitHub [garage-rel].

**CloudServer.** Sa doc Docker montre encore `zenko/cloudserver` [cs-docker].
Sur Docker Hub, ce dépôt n'a plus reçu de tag depuis 2023 : le plus récent,
`latest-0.0.0`, date du 2023-01-10 [cs-hub]. L'image tenue à jour est sur GHCR,
en amd64 seulement : sur un Mac Apple Silicon, le pull échoue avec « no matching
manifest for linux/arm64/v8 » (mesuré). CloudServer n'a donc pas été exécuté.

### Un jeton devenu obligatoire : LocalStack

- Le dépôt `localstack/localstack` est archivé, avec un dernier push le
  2026-03-23. Son README annonce une « Consolidation into the Unified LocalStack
  Image » et dit « this repository is now archived and read-only » [ls-readme].
- « Starting March 23, 2026, LocalStack for AWS will ship as a single, unified
  container image ». Les nouvelles versions demandent « authenticated access
  using a LocalStack for AWS account and an auth token—including in CI »
  [ls-single]. La doc : « An Auth Token is a mandatory credential required to
  start the LocalStack container ». Si l'activation échoue, « LocalStack exits »
  [ls-token]. Le manifeste de `latest` répond 200 à un pull anonyme (mesuré) :
  c'est le démarrage qui refuse, d'après la doc, sans mesure ici.
- Les anciens tags restent utilisables : « prior version tags will still be
  available to run without authentication both locally and within a CI
  environment », mais « previous versions will not receive backport support ».
  Le plan gratuit « is intended for non-commercial use » [ls-road].
- Il reste donc deux voies : un tag figé en février 2026, sans correctifs, ou un
  jeton de CI gardé en secret, sous conditions non commerciales. La première
  vieillit, la seconde fait dépendre la suite d'un compte, ce que l'ADR 0075
  écarte.

### Ce que Frameline demande, candidat par candidat

Garage, versitygw, SeaweedFS, RustFS, rclone et Moto ont été mesurés avec le
script ci-dessus. Les autres sont décrits d'après leur doc ou leur code. RustFS
a été remesuré sur 1.0.1, et Moto avec son authentification activée, le
2026-10-12 (sous-section « Finalistes, mesurés le 2026-10-12 »).

| Candidat | URL présignée vérifiée | `PutBucketCors` | `GET` présigné avec `Origin` | En-têtes CORS sur une erreur | Démarrage ; mémoire |
| --- | --- | --- | --- | --- | --- |
| Garage | oui [garage-s3] : signature altérée, 403 `AccessDenied` ; URL expirée, **400** `InvalidRequest` « Date is too old » | oui, relue par `GetBucketCors` [garage-s3] | la nôtre : `Access-Control-Allow-Origin` et `Vary: Origin` ; une autre : aucun en-tête | **oui** : `Access-Control-Allow-Origin: *` | 3 s ; 4 Mio |
| versitygw | oui : 403 `SignatureDoesNotMatch` ; expirée, 403 `AccessDenied` « Request has expired. » | oui, depuis v1.0.17 [vgw-cors-rel] | la nôtre : l'origine, plus `Access-Control-Allow-Credentials: true` ; une autre : rien | non | 0,4 s ; 48 Mio |
| SeaweedFS (`weed mini`) | oui [sw-sigv4] : 403 `SignatureDoesNotMatch` ; expirée, 403 `AccessDenied` | oui [sw-cors] | la nôtre : l'origine ; une autre : rien | oui, l'origine quand la règle la nomme | 1 s ; 205 Mio |
| RustFS 1.0.1 | oui : signature altérée, 403 `SignatureDoesNotMatch` ; URL expirée, 403 `AccessDenied` | oui, relue par `GetBucketCors` | la nôtre : l'origine et `Vary: Origin` ; une autre : rien | oui, l'origine quand la règle la nomme | 0,6 s ; 255 Mio |
| rclone | oui : 403 ; expirée, 400 | **non** : `PUT ?cors` est pris pour un `CreateBucket` (409 `BucketAlreadyExists`), `GET ?cors` pour une liste d'objets. La doc ne liste aucune opération CORS [rclone-s3] | `*` pour toute origine, même avec `--allow-origin http://localhost:3000`, que la doc décrit comme posant l'en-tête sur chaque réponse [rclone-s3] | avec `--allow-origin` : l'origine réglée | 0,5 s ; 17 Mio |
| S3Mock | **non** : « Accepted but not validated (expiration, signature, HTTP verb not checked) » [s3mock] | non [s3mock] | `*` sur les réponses, d'après ses tests [s3mock-cors] | non lu | non mesuré |
| Moto | **non** : signature altérée et URL expirée, 200. Sans `INITIAL_NO_AUTH_ACTION_COUNT`, « moto will never perform any authentication at all » [moto-iam] | oui [moto-s3] | par défaut, toute origine reçue en écho, `http://other.example` compris : le CORS global (flask-cors) masque la règle [moto-app]. Avec `MOTO_DISABLE_GLOBAL_CORS=1` [moto-settings], la règle du bucket s'applique (mesuré le 2026-10-12) | oui par défaut | 1,2 s ; 102 Mio |
| Moto, authentification activée | **non** : avec `INITIAL_NO_AUTH_ACTION_COUNT`, toute URL présignée, valide comprise, répond **500** (`KeyError: 'HTTP_AUTHORIZATION'`). La signature en en-tête est vérifiée | oui | 500, sans en-têtes | sans objet | 0,9 s ; 98 Mio |
| LocalStack 4.14 | non par défaut : « LocalStack does not validate the signature or the expiration of pre-signed URLs », sauf avec `S3_SKIP_SIGNATURE_VALIDATION=0` [ls-s3] | oui ; règle du bucket appliquée quand elle existe, CORS par défaut de LocalStack sinon [ls-s3] [ls-cors] | non mesuré | non lu | non mesuré |
| CloudServer | oui dans le code (`queryAuthCheck.ts` d'Arsenal, sa bibliothèque d'authentification) [arsenal-query] | oui (`bucketPutCors.js`, `corsResponse.js`) [cs-cors] | non mesuré | non lu | non mesuré |
| S3Proxy | non lu | non : « CORS cannot be configured per bucket », réglage global seulement [s3proxy] | réglage global | non lu | non mesuré |
| Miniflare | oui, en en-tête comme en query string [mf-pr] | non : réponse « not implemented » [mf-src] | toujours permissif : `origin: "*"` [mf-src] | `*` (déduction : le middleware couvre toute la route) | sans objet |

La signature SigV4 en en-tête est acceptée par tous les candidats mesurés.
S3Mock accepte n'importe quels identifiants, « any dummy credentials »
[s3mock], et ses tests envoient des requêtes sans signature [s3mock-cors].

Ce que le tableau veut dire pour Frameline :

- **Trois familles.** S3Mock, Moto et LocalStack ne vérifient pas les signatures
  par défaut : une URL présignée fausse y passerait sans que la CI le voie.
  Moto, une fois sa vérification activée, ne sert plus aucune URL présignée.
  rclone, S3Proxy, Miniflare et S3Mock ont un CORS global ou toujours
  permissif, comme Moto tant que son CORS global reste actif : c'est le défaut
  de MinIO, et une règle R2 fausse y passerait aussi.
  Restent ceux qui appliquent au `GET` une règle CORS par bucket : Garage,
  versitygw, SeaweedFS et RustFS, mesurés, et CloudServer et LocalStack d'après
  leur code.
- **Erreurs.** R2 répond à une URL expirée par une 403 sans en-têtes CORS, et le
  `fetch` du navigateur échoue alors comme une erreur réseau [r2-cors]. Parmi
  les candidats mesurés, versitygw est le seul à faire de même. Garage,
  SeaweedFS et RustFS ajoutent `Access-Control-Allow-Origin` à l'erreur, et le
  `fetch` se résout sur une réponse non `ok`. `bringSoundIn` traite les deux cas
  de la même façon : il lit `response.ok ? response.blob() : undefined` et
  rattrape l'erreur par `.catch` (lu dans `app/utils/brought.ts`). L'écart ne
  change donc rien aujourd'hui.
- **Codes.** Pour une URL expirée, R2 répond 403 `ExpiredRequest` [r2-cors],
  versitygw et SeaweedFS 403 `AccessDenied`, Garage 400. Aucun candidat ne
  reproduit le code de R2 : un test qui vérifie seulement « pas `ok` » tient sur
  tous.
- **`Access-Control-Allow-Credentials: true`.** versitygw l'envoie quand
  l'origine est nommée ; la doc R2 n'en dit rien [r2-cors]. L'effet devrait être
  nul tant que le `fetch` garde son mode de credentials par défaut (déduction).
- **Région.** R2 signe avec `auto`. Garage prend la région de sa configuration,
  `s3_region = "auto"`. versitygw refuse `auto` avec une 400
  `AuthorizationHeaderMalformed` (« expecting "us-east-1" ») tant qu'on ne lui
  passe pas `--region auto`, ou la variable `VGW_REGION` [vgw-main]. SeaweedFS
  a accepté `auto` sans réglage (mesuré).

**Miniflare.** Depuis miniflare 4.20260722.1, un bucket déclaré avec
`s3Credentials` est servi « over an S3-compatible HTTP API, authenticated with
AWS Signature Version 4 (both `Authorization` header and presigned URL query
authentication) », sous `/cdn-cgi/local/r2/s3/<bucket-id>`. Côté Wrangler, la
clé s'appelle `local_dev.experimental_s3_credentials` [mf-pr]. Le code nomme
lui-même l'écart avec R2 : « CORS: cross-origin use is always allowed, as if the
bucket had a permissive CORS policy configured ». `CreateBucket` y répond « not
implemented », puisque le bucket existe par sa déclaration [mf-src]. La page R2
du SDK v3, mise à jour le 2026-04-21, dit encore : « Currently, you cannot use
AWS S3-compatible API while developing locally via `wrangler dev` » [r2-sdk].
Elle est antérieure à cette version. Miniflare n'a pas d'image Docker : il
faudrait un process Node de plus et une clé marquée « experimental », et le
CORS resterait celui de MinIO.

### Provisionnement non interactif

- **Garage.** Depuis v2.3.0, `garage server --single-node --default-bucket`
  monte un nœud seul. Il crée une clé et un bucket à partir de
  `GARAGE_DEFAULT_ACCESS_KEY`, `GARAGE_DEFAULT_SECRET_KEY` et
  `GARAGE_DEFAULT_BUCKET` [garage-qs]. Un `garage.toml` reste nécessaire : au
  moins `rpc_secret`, `replication_factor` et la section `[s3_api]`
  [garage-qs]. Un `configs` Compose à contenu inline le porte sans fichier de
  plus ; l'attribut `content` a été « Introduced in Docker Compose version
  2.23.1 » [compose-configs]. Une clé `GK` suivie de 24 chiffres hexadécimaux a
  été acceptée (mesuré). L'image ne contient que le binaire, sans shell, et le
  healthcheck peut appeler `/garage status` (mesuré). D'après ses logs, Garage
  écoute 0,1 s après son départ ; la première réponse par le port publié est
  arrivée à 3 s.
- **versitygw.** Les identifiants racine passent par `ROOT_ACCESS_KEY` et
  `ROOT_SECRET_KEY` [vgw-main]. Le bucket se crée par l'API S3 (`CreateBucket`).
  Le point d'entrée Docker passe ses arguments tels quels au binaire, ou se
  règle par `VGW_BACKEND` et `VGW_ARGS` [vgw-entry]. L'image est une Alpine qui
  a `wget` et `nc` pour un healthcheck (mesuré). Le backend `posix` garde les
  métadonnées dans des attributs étendus, ou dans un répertoire `--sidecar`
  [vgw-posix]. Sur un `tmpfs`, il a fonctionné sous Docker Desktop (mesuré). Le
  CORS de repli est vide par défaut et ne fait alors rien [vgw-default-cors].
- **SeaweedFS.** `weed mini -dir=/data`, la commande par défaut de l'image, lit
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` et `S3_BUCKET` : « Creates
  initial credentials for the 'mini' user and pre-creates the bucket » [sw-mini].
  Mais il lance aussi master, volume, filer, WebDAV, une interface
  d'administration et un catalogue Iceberg [sw-mini], d'où les 205 Mio. Son
  repli CORS global, `-s3.allowedOrigins`, vaut `*` par défaut [sw-mini]
  [sw-cors] : un bucket sans règle est ouvert à toute origine, et un bucket qui
  en a une suit la sienne (mesuré).
- **RustFS.** Les identifiants passent par `RUSTFS_ACCESS_KEY` et
  `RUSTFS_SECRET_KEY`, et le bucket se crée par l'API. L'image tourne sous
  l'utilisateur `rustfs`, UID et GID 10001 [rustfs]. Un `tmpfs` monté par
  Compose appartient à root, et RustFS 1.0.1 s'arrête alors au démarrage sur
  « Permission denied (os error 13) ». Il faut écrire
  `/data:uid=10001,gid=10001` (mesuré). Un volume nommé neuf reprend le
  propriétaire du `/data` de l'image et marche sans option (mesuré). L'image
  a `nc`, `wget` et `curl` pour un healthcheck (mesuré).
- **La règle CORS**, chez tous : par l'API seulement (`PutBucketCors`). Le
  script qui la pose sur l'émulateur peut donc être celui qui la posera sur R2,
  où l'appel est implémenté [r2-s3] (déduction).

Fragment testé avec `docker compose up -d --wait` : les deux services étaient
sains en 2,1 s, et le script a réussi sur chacun (mesuré). Ports et secrets sont
à choisir.

```yaml
services:
  versitygw:
    image: versity/versitygw:v1.8.0
    command: ['--port', ':7070', '--region', 'auto', 'posix', '/data']
    environment:
      ROOT_ACCESS_KEY: frameline
      ROOT_SECRET_KEY: frameline-secret
    tmpfs:
      - /data
    healthcheck:
      test: ['CMD', 'nc', '-z', '127.0.0.1', '7070']
      interval: 1s
      retries: 30

  garage:
    image: dxflrs/garage:v2.4.1
    command: ['/garage', 'server', '--single-node', '--default-bucket']
    configs:
      - source: garage
        target: /etc/garage.toml
    environment:
      GARAGE_DEFAULT_ACCESS_KEY: GK0123456789abcdef01234567
      GARAGE_DEFAULT_SECRET_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
      GARAGE_DEFAULT_BUCKET: media
    tmpfs:
      - /var/lib/garage
    healthcheck:
      test: ['CMD', '/garage', 'status']
      interval: 1s
      retries: 30

configs:
  garage:
    content: |
      metadata_dir = "/var/lib/garage/meta"
      data_dir = "/var/lib/garage/data"
      db_engine = "sqlite"
      replication_factor = 1
      rpc_bind_addr = "[::]:3901"
      rpc_secret = "0000000000000000000000000000000000000000000000000000000000000000"
      [s3_api]
      s3_region = "auto"
      api_bind_addr = "[::]:3900"
```

### Finalistes, mesurés le 2026-10-12

Quatre candidats ont été mesurés de la même façon, Moto dans trois
configurations :

- versitygw `v1.8.0` ;
- Garage `v2.4.1` ;
- RustFS `1.0.1` ;
- Moto `5.2.3`, par défaut ;
- Moto `5.2.3` avec `MOTO_DISABLE_GLOBAL_CORS=1` seul ;
- Moto `5.2.3` dans sa configuration la plus proche de R2 : en plus,
  `INITIAL_NO_AUTH_ACTION_COUNT=3`.

Pour Moto, la doc dit : « moto will skip performing any authentication as many
times as the variable's value, and only starts authenticating requests
afterwards » [moto-iam] [moto-authz]. `MOTO_DISABLE_GLOBAL_CORS` est décrit
comme « Disable configuring global wildcard CORS » [moto-env]. Les trois
requêtes laissées libres servent à créer un
utilisateur IAM (`CreateUser`), à lui donner une politique `s3:*`
(`PutUserPolicy`) et à créer sa clé (`CreateAccessKey`). Le healthcheck sur
`/moto-api/` n'entame pas ce compte (mesuré).

**Méthode.** C'est le script de la veille, étendu, toujours signé par
aws4fetch :

- *Objet* : écrit avec `Content-Type: audio/mpeg`, puis lu par une URL
  présignée de 300 s, sans `Origin`, avec notre origine, avec une autre, et en
  preflight.
- *Refus* : une signature altérée, une URL expirée (60 s, signée dix minutes plus
  tôt) et un `GET` non signé, tous envoyés avec notre origine.
- *Suppression* : `DeleteObject`, puis une nouvelle URL présignée.
- *Persistance* : un second objet, en `image/webp`, écrit sur un volume nommé.
  Après `docker restart`, il est relu par une URL présignée neuve, avec la
  règle CORS. Puis le même essai avec les fragments Compose : `tmpfs` pour la
  suite, volume nommé pour le développement, `docker compose down` sans `-v`,
  puis `up --wait`.
- *Région* : la même requête, signée avec `auto`, `us-east-1` et `eu-west-3`.
- *Mémoire* : `docker stats`, juste après la sonde, puis au repos quelques
  minutes plus tard.

La machine est la même que la veille. Les chiffres de longévité viennent des
API GitHub et Forgejo : releases du 2025-10-12 au 2026-10-12, auteurs de
commits distincts depuis le 2026-04-12, bots exclus [vgw-api-rel]
[vgw-api-commits] [garage-api-rel] [garage-api-commits] [rustfs-api]
[rustfs-api-commits] [moto-api-rel] [moto-api-commits]. Les autres faits
viennent des fichiers des dépôts.

| Candidat | 1. Signature : altérée ; expirée ; non signée | 2. CORS : notre origine ; une autre ; preflight ; sur une erreur | 3. Région `auto` | 4. `Content-Type` du `PutObject` | 5. `GET` après `DeleteObject` | 6. Persistance, volume nommé | 7. Provisionnement | 8. Image amd64 / arm64 ; 1re réponse ; mémoire | 9. Longévité |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| versitygw v1.8.0 | 403 `SignatureDoesNotMatch` ; 403 `AccessDenied` ; 403 `AccessDenied` | l'origine, avec `Allow-Credentials: true` ; rien ; 200 pour la nôtre, 403 sans en-têtes pour l'autre ; rien sur les 403, **l'origine sur la 404** | avec `--region auto` ; sans, 400 (mesure de la veille). Réglée, elle refuse `us-east-1` | rendu | 404 `NoSuchKey` | objet, bucket et règle CORS retrouvés | 2 variables et 2 options ; bucket et règle par l'API ; 15 lignes de Compose | 31 / 29 Mo ; 0,36 s ; 51 Mio, 30 au repos | Versity Software ; 12 releases en un an ; 41 contributeurs en 6 mois ; Apache-2.0 ; aucun appel sortant par défaut |
| Garage v2.4.1 | 403 `AccessDenied` ; **400** `InvalidRequest` ; 403 `AccessDenied` | l'origine ; rien ; 200 et 403 ; **`*` sur toutes les erreurs** (403, 400, 404) | `s3_region = "auto"` dans `garage.toml` ; elle refuse alors `us-east-1` | rendu | 404 `NoSuchKey` | retrouvés ; `--default-bucket` ne recrée rien au redémarrage | clé et bucket par 3 variables, `garage.toml` dans Compose, règle par l'API ; 31 lignes | 28 / 26 Mo ; 0,48 s ; 47 Mio, 10 au repos | association Deuxfleurs ; 5 releases ; 34 contributeurs ; AGPL-3.0 ; aucun appel sortant par défaut |
| RustFS 1.0.1 | 403 `SignatureDoesNotMatch` ; 403 `AccessDenied` ; 403 `AccessDenied` | l'origine ; rien ; 200 et 403 sans en-têtes ; **l'origine sur les 403 et la 404** | toute région, sans réglage | rendu | 404 `NoSuchKey` | retrouvés | 2 variables (3 avec `RUSTFS_CHECK_UPDATE`) ; bucket et règle par l'API ; `tmpfs` avec `uid=10001,gid=10001` ; 15 lignes | 111 / 105 Mo ; 0,64 s ; 255 Mio, 80 au repos | RustFS, Inc. ; 61 releases dont 59 préversions, 1.0.0 le 2026-09-16 ; 86 contributeurs ; Apache-2.0 ; **requête à `version.rustfs.com` au démarrage** |
| Moto 5.2.3, par défaut | **200 ; 200** ; 403, corps vide | toute origine renvoyée en écho, l'autre comprise, erreurs comprises ; preflight de l'autre : 403, avec son origine en écho | signature acceptée ; `CreateBucket` exige `LocationConstraint` à `auto`, sinon 400 `IllegalLocationConstraintException` [moto-s3-loc] | rendu | 404 `NoSuchKey` | **non** : `NoSuchBucket` après redémarrage | aucune variable ; bucket et règle par l'API ; 9 lignes | 99 / 99 Mo ; 0,89 s ; 88 Mio, 55 au repos | communauté, finances sur OpenCollective ; 13 releases, dont 5.2.4 le 2026-10-11 ; 57 contributeurs ; Apache-2.0 ; aucun appel sortant pour S3 |
| Moto, `MOTO_DISABLE_GLOBAL_CORS=1` | **200 ; 200** ; 403 | l'origine ; rien ; 200 et 403 sans `Allow-Origin` ; rien sur la 404 | comme par défaut | rendu | 404 `NoSuchKey` | non | 1 variable ; 11 lignes | non remesuré | idem |
| Moto, la plus proche de R2 | en-tête : secret faux, 403 `SignatureDoesNotMatch`. Présignée : **500 pour toute URL, valide comprise** ; non signée : 403 | 500 sans en-têtes ; preflight 500 | comme par défaut | sans objet : 500 | `DeleteObject` 204, lecture 500 | non, et le compteur repart de zéro | 2 variables, et un script IAM de 3 appels avant toute autre requête ; la clé est tirée par Moto à chaque démarrage ; 12 lignes, plus 19 | 99 / 99 Mo ; 0,94 s ; 98 Mio, 55 au repos | idem |

Un bucket sans règle CORS ne renvoie aucun en-tête CORS chez versitygw, Garage,
RustFS et Moto sans CORS global ; Moto par défaut renvoie l'origine (mesuré).

Ce que le tableau veut dire pour Frameline :

- **Moto est écarté.** Aucune de ses configurations ne vérifie à la fois une
  URL présignée et une règle CORS par bucket :
  - par défaut, il ne vérifie pas les signatures et renvoie toute origine ;
  - avec `MOTO_DISABLE_GLOBAL_CORS=1`, la règle du bucket s'applique comme sur
    R2, mais une URL altérée ou expirée passe toujours ;
  - avec l'authentification, aucune URL présignée n'est servie. La classe qui
    vérifie la requête ne lit que l'en-tête `Authorization`
    (`self._headers["Authorization"]`) [moto-ac]. Une URL présignée n'en porte
    pas : le serveur lève `KeyError: 'HTTP_AUTHORIZATION'` et répond 500
    (mesuré). Deux recherches dans les issues de Moto n'ont rien trouvé sur ce
    cas.

  Il garde tout en mémoire, ce qui ne convient pas à `compose.dev.yaml`. Son
  enregistreur, `MOTO_ENABLE_RECORDING`, rejoue les requêtes sur demande ; ce
  n'est pas une persistance [moto-recorder]. Sa clé d'accès est tirée au
  hasard par `CreateAccessKey`, à chaque démarrage, et devrait être transmise à
  l'app après coup.
- **versitygw, Garage et RustFS se valent sur les points 1 et 4 à 6.** Les trois
  refusent une signature altérée, une URL expirée et un `GET` non signé. Ils
  rendent le `Content-Type` écrit et répondent 404 `NoSuchKey` après un
  `DeleteObject`, ce que fera le balayage quotidien. Ils retrouvent objet, bucket
  et règle CORS après `docker restart` comme après `down` puis `up`. Leurs
  fragments Compose passent de `tmpfs` à un volume nommé en quatre lignes de
  `compose.dev.yaml` : `tmpfs: !reset []`, le volume, et son nom sous
  `volumes:`.
- **Erreurs : versitygw reste le plus proche de R2, avec une nuance.** R2 répond
  à une URL expirée par une 403 `ExpiredRequest` sans en-têtes CORS [r2-cors].
  versitygw ne met aucun en-tête CORS sur ses 403, mais en met sur sa 404.
  RustFS les met sur toutes ses erreurs, et Garage met `*` sur toutes les
  siennes. Ce que R2 envoie sur une 404 n'est pas documenté. `bringSoundIn`
  traite déjà de la même façon un `fetch` rejeté et une réponse non `ok`.
- **Région.** R2 accepte `auto`, et `us-east-1` ou une valeur vide y renvoient.
  versitygw et Garage, réglés sur `auto`, refusent `us-east-1` : ils sont plus
  stricts que R2. RustFS accepte toute région. Une région fausse dans la
  configuration de l'app passerait donc sur RustFS, alors que R2 la refuserait
  si elle n'est ni `auto` ni `us-east-1` (déduction).
- **Provisionnement.** La règle CORS passe par l'API chez tous. Le script de
  17 lignes écrit pour la mesure crée le bucket s'il manque, puis pose la
  règle, et il est idempotent. Garage est le seul à créer bucket et clé par
  variables d'environnement, au prix d'un `garage.toml` porté dans le fichier
  Compose. versitygw a besoin de `--region auto`. RustFS a besoin d'un
  propriétaire sur son `tmpfs`, sans quoi il s'arrête (voir « Provisionnement
  non interactif »).
- **Empreinte.** La mémoire varie beaucoup selon le moment de la mesure. Sur
  `tmpfs`, juste après le démarrage, elle était de 37 Mio pour Garage, 45 pour
  versitygw et 196 pour RustFS. Au repos, plus tard, elle n'était plus que de
  10, 30 et 80 Mio. Les « 3 s ; 4 Mio » de Garage mesurés la veille n'ont pas
  été retrouvés : 0,48 s, et jamais moins de 10 Mio.
- **Longévité.**
  - *versitygw* est l'outil d'une entreprise : « Copyright 2023 Versity
    Software » [vgw-notice]. Il sort une release par mois environ, et le
    premier auteur fait 322 des 598 commits des six derniers mois. Ses métriques
    StatsD sont désactivées par défaut [vgw-metrics].
  - *Garage* est porté par l'association Deuxfleurs [garage-readme]. Sa
    gouvernance dit : « Alex (handle `lx`) is the lead developer » et
    « Decisions are taken by lazy consensus » [garage-gov]. NGI et NLnet l'ont
    financé de 2021 à 2025, et la page du projet ne cite rien pour 2026
    [garage-site]. Il y a eu près de cinq mois entre v2.3.0 et v2.4.0
    [garage-api-rel]. Les traces OpenTelemetry ne partent que si
    `admin.trace_sink` est renseigné [garage-trace].
  - *RustFS* appartient à RustFS, Inc., à qui sa CLA permet de redistribuer les
    contributions « under any license, including proprietary or commercial
    licenses » [rustfs-cla]. Sa première version stable date du 2026-09-16,
    après 59 préversions en un an [rustfs-api]. Trois auteurs font
    environ 82 % des 4 334 commits des six derniers mois.
  - *RustFS, au démarrage*, contacte `version.rustfs.com` :
    `DEFAULT_UPDATE_CHECK: bool = true`, et la requête part vers
    `https://version.rustfs.com/latest.json` avec la version dans l'agent
    utilisateur [rustfs-update-const] [rustfs-update]. Mesuré : avec les logs en
    `debug`, la connexion TLS s'ouvre et la version publiée est lue ; avec
    `RUSTFS_CHECK_UPDATE=false`, aucune trace [rustfs-env-doc]. Son README
    affiche pourtant « No Telemetry » [rustfs-readme].
  - *Moto* est un projet communautaire : « Our finances are managed by
    OpenCollective » [moto-readme]. Il se fixe une release « every 1 or 2
    weeks » [moto-releases-doc], et sa 5.2.4 est sortie le 2026-10-11, après
    l'image mesurée.
  - Aucun des quatre dépôts n'est archivé. Les deux précédents restent ceux de
    plus haut : MinIO, archivé et sans image publique, et LocalStack, qui demande
    un jeton depuis le 2026-03-23.

Ces mesures ne changent pas la recommandation qui suit : versitygw, puis
Garage. Quatre passages y ont été corrigés : les erreurs de versitygw, la
mémoire de Garage, la 1.0 de RustFS avec sa requête au démarrage, et le cas de
Moto authentifié.

### Recommandation

1. **Versity Gateway.** C'est le plus proche de R2 sur ce que Frameline teste.
   Il applique au `GET` une règle CORS par bucket et refuse le preflight d'une
   autre origine. Ses refus (403) ne portent pas d'en-têtes CORS, et il répond
   403 à une URL expirée comme à une URL altérée. L'image fait 31 Mo, démarre en
   0,4 s, est sous Apache-2.0 et se tire sans compte ; la dernière release date
   du 2026-09-04. Deux réglages : `--region auto`, et, au démarrage de la
   suite, créer le bucket puis poser la règle par l'API.
2. **Garage.** C'est le plus simple à provisionner, avec la clé et le bucket en
   variables d'environnement, et le plus léger : 28 Mo, et 10 Mio au repos. Sa
   région se règle sur `auto`, comme R2. Deux écarts avec R2 :
   `Access-Control-Allow-Origin: *` sur les erreurs, et 400 pour une URL
   expirée. Il faut aussi porter un `garage.toml`, et la licence est
   l'AGPL-3.0, comme celle de MinIO.

SeaweedFS et RustFS passent les mêmes épreuves, mais pèsent plus lourd : 193 et
111 Mo, plusieurs composants pour SeaweedFS. RustFS a sorti sa 1.0.0 le
2026-09-16, et il interroge `version.rustfs.com` à chaque démarrage tant que
`RUSTFS_CHECK_UPDATE` n'est pas à `false`. Les autres ne vérifient pas les signatures, n'ont pas de CORS par
bucket, demandent un jeton, ou, pour CloudServer, n'ont pas d'image arm64.
Moto, une fois son authentification activée, répond 500 à toute URL
présignée.

### Trous propres à ce complément

- **LocalStack `latest` sans jeton** : le refus de démarrer est documenté, pas
  mesuré.
- **CloudServer, S3Mock, S3Proxy, LocalStack et Miniflare** : non exécutés,
  faute de bande passante pendant la mesure, ou d'image arm64 pour CloudServer.
  Leur comportement est lu dans la doc ou le code.
- **Temps de démarrage** : mesurés sur un Mac, pas sur un runner GitHub.
- **Mémoire** : elle baisse d'un facteur 3 à 4 entre le démarrage et le repos.
  Les chiffres sont des ordres de grandeur.
- **R2, en-têtes CORS sur une 404** : non documentés, et pas mesurés.
  versitygw et RustFS en mettent.
- **Moto, URL présignées avec authentification** : la 500 est mesurée sur
  5.2.3, pas sur la 5.2.4 sortie le 2026-10-11. Aucune issue n'a été trouvée sur
  ce cas.
- **RustFS sur le `tmpfs` d'un runner GitHub** : l'option
  `uid=10001,gid=10001` n'a été vérifiée que sous Docker Desktop.
- **RustFS, requête à `version.rustfs.com`** : vue dans ses logs en `debug`,
  pas dans une capture réseau.
- **Contributeurs** : comptés par login GitHub ou par e-mail, sans fusion des
  doublons, sauf deux chez Garage. Le filtre `since` de l'API Forgejo a semblé
  ignoré, et les commits de Garage ont été filtrés par date après coup.
- **versitygw sur le `tmpfs` d'un runner GitHub** : les attributs étendus n'ont
  été vérifiés que sous Docker Desktop.
- **versitygw, `Access-Control-Allow-Credentials: true`** : sans effet attendu,
  pas testé dans un navigateur.
- **Wrangler** : la version qui apporte `local_dev.experimental_s3_credentials`
  n'a pas été retrouvée.

### Sources de ce complément

[garage-hub]: https://hub.docker.com/r/dxflrs/garage
[garage-rel]: https://git.deuxfleurs.fr/Deuxfleurs/garage/releases
[garage-lic]: https://git.deuxfleurs.fr/Deuxfleurs/garage/src/branch/main-v2/LICENSE
[garage-qs]: https://garagehq.deuxfleurs.fr/documentation/quick-start/
[garage-s3]: https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/
[sw]: https://github.com/seaweedfs/seaweedfs
[sw-rel]: https://github.com/seaweedfs/seaweedfs/releases
[sw-mini]: https://github.com/seaweedfs/seaweedfs/blob/master/weed/command/mini.go
[sw-cors]: https://github.com/seaweedfs/seaweedfs/blob/master/weed/s3api/s3api_bucket_cors_handlers.go
[sw-sigv4]: https://github.com/seaweedfs/seaweedfs/blob/master/weed/s3api/auth_signature_v4.go
[vgw]: https://github.com/versity/versitygw
[vgw-rel]: https://github.com/versity/versitygw/releases
[vgw-cors-rel]: https://github.com/versity/versitygw/releases/tag/v1.0.17
[vgw-main]: https://github.com/versity/versitygw/blob/main/cmd/versitygw/main.go
[vgw-entry]: https://github.com/versity/versitygw/blob/main/docker-entrypoint.sh
[vgw-posix]: https://github.com/versity/versitygw/blob/main/backend/posix/posix.go
[vgw-default-cors]: https://github.com/versity/versitygw/blob/main/s3api/middlewares/apply-default-cors.go
[vgw-notice]: https://github.com/versity/versitygw/blob/main/NOTICE
[vgw-metrics]: https://github.com/versity/versitygw/blob/v1.8.0/cmd/versitygw/main.go#L771-L787
[vgw-api-rel]: https://api.github.com/repos/versity/versitygw/releases?per_page=100
[vgw-api-commits]: https://api.github.com/repos/versity/versitygw/commits?since=2026-04-12T00:00:00Z&per_page=100
[garage-readme]: https://git.deuxfleurs.fr/Deuxfleurs/garage/src/branch/main-v2/README.md
[garage-gov]: https://git.deuxfleurs.fr/Deuxfleurs/garage/src/branch/main-v2/GOVERNANCE.md
[garage-site]: https://garagehq.deuxfleurs.fr/
[garage-api-rel]: https://git.deuxfleurs.fr/api/v1/repos/Deuxfleurs/garage/releases?limit=50
[garage-api-commits]: https://git.deuxfleurs.fr/api/v1/repos/Deuxfleurs/garage/commits?sha=main-v2&limit=50
[garage-trace]: https://garagehq.deuxfleurs.fr/documentation/reference-manual/configuration/#admin_trace_sink
[rustfs]: https://github.com/rustfs/rustfs
[rustfs-rel]: https://github.com/rustfs/rustfs/releases
[rustfs-readme]: https://github.com/rustfs/rustfs/blob/1.0.1/README.md
[rustfs-cla]: https://github.com/rustfs/rustfs/blob/1.0.1/CLA.md
[rustfs-api]: https://api.github.com/repos/rustfs/rustfs/releases?per_page=100
[rustfs-api-commits]: https://api.github.com/repos/rustfs/rustfs/commits?since=2026-04-12T00:00:00Z&per_page=100
[rustfs-update-const]: https://github.com/rustfs/rustfs/blob/1.0.1/crates/config/src/constants/console.rs#L88-L96
[rustfs-update]: https://github.com/rustfs/rustfs/blob/1.0.1/rustfs/src/update.rs#L81-L101
[rustfs-env-doc]: https://github.com/rustfs/docs.rustfs.com/blob/main/content/en/reference/environment-variables.md
[cs]: https://github.com/scality/cloudserver
[cs-rel]: https://github.com/scality/cloudserver/releases
[cs-ghcr]: https://github.com/scality/cloudserver/pkgs/container/cloudserver
[cs-docker]: https://github.com/scality/cloudserver/blob/development/9.5/docs/DOCKER.rst
[cs-hub]: https://hub.docker.com/r/zenko/cloudserver/tags
[cs-cors]: https://github.com/scality/cloudserver/blob/development/9.5/lib/api/bucketPutCors.js
[arsenal-query]: https://github.com/scality/arsenal/blob/development/8.6/lib/auth/v4/queryAuthCheck.ts
[ls-readme]: https://github.com/localstack/localstack
[ls-rel]: https://github.com/localstack/localstack/releases
[ls-license]: https://github.com/localstack/localstack/blob/main/LICENSE.txt
[ls-single]: https://blog.localstack.cloud/localstack-single-image-next-steps/
[ls-road]: https://blog.localstack.cloud/the-road-ahead-for-localstack/
[ls-token]: https://docs.localstack.cloud/aws/getting-started/auth-token/
[ls-s3]: https://docs.localstack.cloud/aws/services/s3/
[ls-cors]: https://github.com/localstack/localstack/blob/main/localstack-core/localstack/services/s3/cors.py
[s3mock]: https://github.com/adobe/S3Mock
[s3mock-rel]: https://github.com/adobe/S3Mock/releases
[s3mock-cors]: https://github.com/adobe/S3Mock/blob/main/integration-tests/src/test/kotlin/com/adobe/testing/s3mock/its/CorsIT.kt
[rclone]: https://github.com/rclone/rclone
[rclone-rel]: https://github.com/rclone/rclone/releases
[rclone-s3]: https://rclone.org/commands/rclone_serve_s3/
[moto]: https://github.com/getmoto/moto
[moto-rel]: https://github.com/getmoto/moto/releases
[moto-iam]: https://github.com/getmoto/moto/blob/master/docs/docs/iam.rst
[moto-s3]: https://github.com/getmoto/moto/blob/master/moto/s3/responses.py
[moto-app]: https://github.com/getmoto/moto/blob/master/moto/moto_server/werkzeug_app.py
[moto-settings]: https://github.com/getmoto/moto/blob/master/moto/settings.py
[moto-env]: https://github.com/getmoto/moto/blob/master/docs/docs/configuration/environment_variables.rst
[moto-ac]: https://github.com/getmoto/moto/blob/5.2.3/moto/iam/access_control.py#L231-L234
[moto-authz]: https://github.com/getmoto/moto/blob/5.2.3/moto/core/authorization.py#L37-L65
[moto-s3-loc]: https://github.com/getmoto/moto/blob/5.2.3/moto/s3/responses.py#L1103-L1108
[moto-recorder]: https://github.com/getmoto/moto/blob/master/docs/docs/configuration/recorder/index.rst
[moto-readme]: https://github.com/getmoto/moto/blob/master/README.md
[moto-releases-doc]: https://github.com/getmoto/moto/blob/master/docs/docs/releases.rst
[moto-api-rel]: https://api.github.com/repos/getmoto/moto/releases?per_page=100
[moto-api-commits]: https://api.github.com/repos/getmoto/moto/commits?since=2026-04-12T00:00:00Z&per_page=100
[s3proxy]: https://github.com/gaul/s3proxy
[s3proxy-rel]: https://github.com/gaul/s3proxy/releases
[mf-rel]: https://github.com/cloudflare/workers-sdk/releases/tag/miniflare%404.20260722.1
[mf-pkg]: https://github.com/cloudflare/workers-sdk/blob/main/packages/miniflare/package.json
[mf-pr]: https://github.com/cloudflare/workers-sdk/pull/14280
[mf-src]: https://github.com/cloudflare/workers-sdk/blob/main/packages/miniflare/src/workers/r2/s3/index.worker.ts
[compose-configs]: https://docs.docker.com/reference/compose-file/configs/

- Garage : [Docker Hub][garage-hub], [releases][garage-rel],
  [licence][garage-lic], [démarrage rapide][garage-qs],
  [compatibilité S3][garage-s3].
- SeaweedFS : [dépôt][sw], [releases][sw-rel], [`weed mini`][sw-mini],
  [CORS][sw-cors], [signature v4][sw-sigv4].
- Versity Gateway : [dépôt][vgw], [releases][vgw-rel],
  [release v1.0.17, CORS par bucket][vgw-cors-rel], [options][vgw-main],
  [point d'entrée Docker][vgw-entry], [backend posix][vgw-posix],
  [CORS de repli][vgw-default-cors], [`NOTICE`][vgw-notice],
  [métriques][vgw-metrics], API : [releases][vgw-api-rel],
  [commits][vgw-api-commits].
- Garage, longévité : [README][garage-readme], [gouvernance][garage-gov],
  [site][garage-site], [traces][garage-trace], API Forgejo :
  [releases][garage-api-rel], [commits][garage-api-commits].
- RustFS : [dépôt][rustfs], [releases][rustfs-rel], [README][rustfs-readme],
  [CLA][rustfs-cla], [constante de la vérification][rustfs-update-const],
  [requête de version][rustfs-update], [variables][rustfs-env-doc], API :
  [releases][rustfs-api], [commits][rustfs-api-commits].
- Zenko CloudServer : [dépôt][cs], [releases][cs-rel], [GHCR][cs-ghcr],
  [doc Docker][cs-docker], [Docker Hub][cs-hub], [CORS][cs-cors],
  [Arsenal, URL présignées][arsenal-query].
- LocalStack : [dépôt archivé][ls-readme], [releases][ls-rel],
  [licence][ls-license], [image unique][ls-single], [feuille de route][ls-road],
  [jeton][ls-token], [S3][ls-s3], [CORS S3][ls-cors].
- Adobe S3Mock : [dépôt][s3mock], [releases][s3mock-rel], [test CORS][s3mock-cors].
- rclone : [dépôt][rclone], [releases][rclone-rel], [`serve s3`][rclone-s3].
- Moto : [dépôt][moto], [releases][moto-rel], [authentification][moto-iam],
  [réponses S3][moto-s3], [serveur][moto-app], [réglages][moto-settings],
  [variables][moto-env], [contrôle d'accès][moto-ac],
  [compteur sans authentification][moto-authz],
  [`LocationConstraint`][moto-s3-loc], [enregistreur][moto-recorder],
  [README][moto-readme], [rythme des releases][moto-releases-doc], API :
  [releases][moto-api-rel], [commits][moto-api-commits].
- S3Proxy : [dépôt][s3proxy], [releases][s3proxy-rel].
- Miniflare : [release 4.20260722.1][mf-rel], [`package.json`][mf-pkg],
  [pull request de l'endpoint S3][mf-pr], [code de l'endpoint][mf-src].
- Docker Compose : [`configs`][compose-configs].
