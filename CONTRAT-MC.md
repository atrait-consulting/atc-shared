# Contrat d'intégration MC

**Plateforme interne ATRAIT Consulting — https://my.atrait-consulting.com**

À lire avant d'écrire la première ligne d'une application MC. Ce document est la référence :
si un autre écrit dit le contraire, c'est celui-ci qui fait foi.

*État au 30/08/2026 — six applications en service. La recette pour en ajouter une est au §8, la
donnée que toutes partagent au §7.*

---

## 1 · Le principe

**Le portail est le seul à savoir authentifier. Les applications ne savent que vérifier.**

Une application MC qui contient un écran de connexion est une application non conforme, et sa
demande de fusion sera refusée.

Tout vit sur **une seule origine**. Les applications sont servies sous un chemin — `/sonar`,
`/crm` — et relayées par le portail vers leur propre déploiement. Chacune garde son dépôt, sa
livraison et ses variables ; le navigateur, lui, ne parle qu'à `my.atrait-consulting.com`.

```
                         Entra ID (tenant ATRAIT)
                                   │ OIDC
                                   ▼
navigateur ──▶  my.atrait-consulting.com  ──── rewrites ────▶  déploiements Vercel
                │  /login  /portail  /admin                    mc-sonar      (basePath /sonar)
                │  /sonar/*  /crm/*  /cctp/*                   mc-crm        (basePath /crm)
                │  /catalogue/*  /parapheur/*                  mc-cctp       (basePath /cctp)
                ▼         relayés                              mc-catalogue  (basePath /catalogue)
        Supabase « atc-platform »                              mc-parapheur  (basePath /parapheur)
        identity · sonar · crm · cctp · catalogue · parapheur
```

| Slug | Application | Ce qu'elle fait | Schéma |
|---|---|---|---|
| — | **MC Hub** | portail, connexion, matrice des droits | `identity` |
| `sonar` | **MC SONAR** | simulation acoustique, études | `sonar` |
| `crm` | **MC CRM** | sociétés, contacts, affaires | `crm` |
| `cctp` | **MC CCTP** | pièces écrites, projets, espaces | `cctp` |
| `catalogue` | **myCatalogue** | le catalogue d'articles, **commun à tous** — voir §7 | `catalogue` |
| `parapheur` | **MC PARAPHEUR** | tamponner un PDF et pouvoir le prouver | `parapheur` |

La septième s'ajoute sans rien toucher aux six autres : la recette est au §8.

Ce choix d'une origine unique n'est pas cosmétique : il supprime tout partage de cookie entre
hôtes, et avec lui la famille de pannes qui va avec — session invisible sur iPhone, cookie en
double, boucle de connexion inexplicable. **Il n'y a aucun domaine de cookie à configurer nulle
part.** Si vous en voyez un dans du code, c'est un vestige : supprimez-le.

Deux niveaux de contrôle, toujours les deux :

1. Le **middleware** lit le droit dans le jeton, et **ne fait aucun appel réseau** — voir §10,
   « un 504 sur des pages qui marchaient hier ». Il aiguille ; il n'autorise pas.
2. Toute **écriture** et toute donnée sensible rappelle `hasAppAccess()`, qui interroge la base.
   Un jeton reste valide jusqu'à son expiration ; sans ce second niveau, une révocation
   n'aurait aucun effet immédiat.

Le middleware ne vérifie pas la signature du jeton, et n'a pas à le faire : rien n'est servi sur la
foi de sa lecture. Chaque page revalide la session côté serveur, chaque requête repasse par la RLS
avec le vrai jeton. Un cookie forgé n'obtient qu'une page qui échoue.

> **Pré-requis, pas réglage.** Le hook `identity.custom_access_token_hook` doit être activé dans
> Supabase (Authentication → Hooks → *Customize Access Token (JWT) Claims*). Sans lui, le claim
> `mc` est absent, le middleware n'a plus rien à lire, et les applications renvoient au portail.
> C'est le seul réglage du tableau de bord dont dépend le fonctionnement de la plateforme.

---

## 2 · Ajouter un collaborateur

Il n'y a **aucune invitation à envoyer**. Avec le SSO Microsoft, quelqu'un existe dans la
plateforme dès sa première connexion, et pas avant.

**1.** Côté Microsoft, si *Assignment required* est activé sur l'application MC Hub, l'ajouter
dans **Entra ID → Enterprise applications → MC Hub → Users and groups**.

**2.** Lui envoyer **https://my.atrait-consulting.com**. Il se connecte, tombe sur un portail
vide avec des tuiles grisées. C'est normal : son profil vient d'être créé.

**3.** Sur **/admin**, il apparaît dans la matrice. Une case par application :

| Rôle plateforme | Ce qu'il donne, dans toute application |
|---|---|
| `owner` / `admin` | tous droits, y compris les réglages de l'application |
| `editor` | crée et modifie |
| `viewer` | consulte, ne modifie rien |
| `—` | tuile grisée : l'application n'existe pas pour cette personne |

Deux droits se donnent séparément parce qu'ils ne suivent pas la matrice :

- **Tenir le catalogue** (`catalogue` en `owner`/`admin`/`editor`) donne l'écriture sur la matière
  commune de toutes les applications. À ne pas confondre avec l'accès en lecture, que tout titulaire
  de `cctp` ou `sonar` reçoit d'office — voir §7.
- **Rendre un document privé** dans MC PARAPHEUR est réservé à une liste d'adresses tenue en base
  (`parapheur.confidentialite`), et non au rôle. Une liste d'adresses plutôt que d'identifiants :
  le droit existe avant le compte, et s'applique dès la première connexion.

**4.** Cliquer **Voir** sur sa ligne affiche son portail tel qu'il l'aura. À faire avant de lui
dire que c'est prêt : ça évite le « je ne vois rien » du lendemain matin.

**Pour retirer un accès** : décocher une application la lui retire. Décocher **Actif** ferme
tout d'un coup — c'est le geste du départ. Et si son compte Microsoft est désactivé, il ne peut
plus se connecter du tout : la plateforme n'a pas de mot de passe à elle.

**Le rôle applicatif ne se saisit jamais dans l'application.** Il découle de la matrice. Une
application qui gère ses propres rôles crée un second endroit où accorder un accès, et donc, tôt
ou tard, deux vérités qui divergent.

---

## 3 · Vos accès

| Élément | Fourni par |
|---|---|
| Compte `@atrait-consulting.com` (M365) | Julien |
| Accès au dépôt de l'application sur GitHub | Julien |
| Accès à l'équipe Vercel | Julien |
| Le `.env.local` du projet, par canal sécurisé — **jamais dans Git** | Julien |
| Node 20+, `gh`, `supabase`, `vercel` | vous |
| Un dossier de travail **hors iCloud Drive** | vous |

> **Ne clonez jamais dans iCloud Drive.** iCloud resynchronise `node_modules` et `.next` pendant
> que le serveur de développement écrit dedans : modules fantômes, compilations qui échouent une
> fois sur trois, fichiers verrouillés. Deux projets ATRAIT en ont déjà fait les frais.

**Où vivent les dépôts** — répartition dictée par Vercel, dont le plan Hobby refuse de déployer
un dépôt privé appartenant à une organisation :

| Dépôt | Emplacement |
|---|---|
| `mc-hub`, `mc-sonar`, `mc-crm`, `mc-cctp`, `mc-catalogue`, `mc-parapheur` | compte personnel `tontondubled`, privés |
| `atc-db` | organisation `atrait-consulting`, privé — jamais déployé |
| `atc-shared` | organisation, **public** — le build doit pouvoir l'installer |

> Une application MC ne se crée donc **pas** sous l'organisation. `gh repo create
> atrait-consulting/mc-x --private` réussit, et Vercel refuse ensuite de s'y connecter — il faut
> tout recommencer sous le compte personnel. C'est arrivé sur `mc-parapheur`.

---

## 4 · Les règles

Les quatre en gras font échouer la revue sans discussion.

| | |
|---|---|
| **R01** | **Aucune application ne gère l'authentification.** Pas de page de connexion, pas de cookie maison, pas de mot de passe, pas de `SESSION_SECRET`. |
| R02 | L'application déclare `basePath: '/<slug>'` et n'est jamais servie ailleurs que sous ce chemin. |
| R03 | `src/middleware.ts` contient `atcMiddleware('<slug>')`, et rien d'autre. |
| R04 | Le `matcher` est **recopié en littéral** et contient l'entrée `'/'`. Voir §5 — Next refuse un identifiant importé, et sans `'/'` la racine se sert sans session. |
| **R05** | **Deux niveaux de contrôle.** Le middleware ne suffit pas. **Chaque route et chaque action** — pas seulement celles qui écrivent — commence par `getAtcUser()` puis `hasAppAccess()`. L'audit du 30/08/2026 a trouvé deux relais de MC CRM (`/api/claude`, `/api/odoo`) que le middleware laissait passer et qui n'autorisaient rien eux-mêmes : ils ne « lisaient » que des données, ils les faisaient sortir. |
| R06 | Le client Supabase du navigateur est `createBrowserClient` de `@supabase/ssr`. Le client ordinaire ignore les cookies et parle en anonyme. |
| R07 | Quatre rôles pour toute la plateforme : `owner`, `admin`, `editor`, `viewer`. Une application peut en ignorer un, jamais en inventer un cinquième. |
| R08 | Chaque solution a son schéma PostgreSQL. Jamais de table métier dans `public`. |
| R09 | Aucune application ne crée de table d'utilisateurs. On stocke un `user_id uuid` et on résout le profil via `/api/moi`. |
| R10 | Les identifiants sont des **UUID**. Les colonnes sont typées `uuid` : un identifiant maison est refusé à l'écriture. *Une seule dérogation à ce jour, le schéma `cctp` : la règle existe parce que MC CRM fabrique ses identifiants dans le navigateur, où seul un UUID évite les collisions. Là où tout est créé par la base, le compteur suffit — mais cela s'écrit, sinon c'est lu comme un oubli.* |
| R11 | Les écritures groupées suivent l'ordre des dépendances, les suppressions l'ordre inverse. |
| R12 | Toute migration passe par `atc-db`, et **uniquement** par lui : `supabase db push` s'exécute depuis ce dépôt, jamais depuis un dépôt applicatif, et jamais aucun DDL à la main dans le tableau de bord. Une migration poussée ne se modifie pas : on écrit la suivante. |
| **R13** | **Aucun secret en `NEXT_PUBLIC_*`, aucun `.env` versionné.** La clé `service_role` ne quitte jamais le serveur et ne s'importe jamais depuis un composant `"use client"`. |
| R14 | Déployer, c'est fusionner sur `main`. Ce qui est en ligne correspond toujours à un commit relu. **Aujourd'hui, seul `mc-sonar` fonctionne ainsi** ; les cinq autres projets Vercel ne sont pas reliés à GitHub et se déploient à la main. Un `git push` y réussit, ne déclenche rien, et l'alias continue de servir l'ancien build — sans le moindre signal. Toute nouvelle application se relie à GitHub **avant** son premier déploiement. |
| **R15** | **Le schéma d'une nouvelle application n'est PAS exposé dans les réglages Data API.** Tout passe par des enveloppes `public.<slug>_*` en `security definer`. Voir §6 : ce geste a réécrit les privilèges des rôles d'API trois fois sur cette plateforme. |
| R16 | L'application applique la charte partagée : `node atc-shared/theme/appliquer.mjs <app>/…`. Poser les jetons ne suffit pas — les libellés, les boutons et les émojis restent à reprendre à la main, et cela ne se voit qu'en ouvrant la page. |
| R17 | **Aucune ressource externe.** La CSP du portail n'autorise ni CDN, ni `eval`, ni caméra. Les bibliothèques se vendorisent dans `public/vendor/`. Voir §5. |
| R18 | Ce que la base décide, l'application ne le redit pas. Un format d'identifiant, une liste de valeurs, une règle de droit : si elle est en base, l'application l'interroge — elle ne la recopie pas dans un contrôle de forme qui vieillira sans prévenir. |

---

## 5 · Protéger une application

Voici **l'intégralité** du code d'authentification d'une application MC.

`src/middleware.ts` :

```ts
import { atcMiddleware } from "@atc/auth/middleware";

export default atcMiddleware("crm");

export const config = {
  // Next analyse ce champ à la compilation et refuse un identifiant importé :
  // le motif se recopie. L'entrée '/' est indispensable — sans elle, la racine
  // de l'application se sert sans session.
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

Sur une page :

```ts
import { requireApp } from "@atc/auth/server";

export default async function Page() {
  await requireApp("crm");   // renvoie vers le portail ou la page de refus
  // …
}
```

Sur une Server Action — **c'est ici que se joue le second niveau** :

```ts
import { hasAppAccess, appRole } from "@atc/auth/server";

export async function updateDeal(input: FormData) {
  "use server";
  if (!(await hasAppAccess("crm")))
    return { ok: false, message: "Accès refusé." };
  if ((await appRole("crm")) === "viewer")
    return { ok: false, message: "Votre accès est en lecture seule." };
  // …
}
```

> Ne jamais lever d'exception dans une Server Action : retournez
> `{ ok: false, message }`. Une exception remonte à la frontière d'erreur de React et affiche un
> écran générique où l'utilisateur ne comprend ni ce qui s'est passé, ni quoi faire.

Déconnexion — un `POST` vers le portail, jamais un `signOut()` côté client :

```tsx
import { signOutUrl } from "@atc/auth/server";

<form action={signOutUrl()} method="post">
  <button type="submit">Déconnexion</button>
</form>
```

Variables d'environnement, identiques partout :

```
NEXT_PUBLIC_ATC_ID_URL=https://<ref>.supabase.co
NEXT_PUBLIC_ATC_ID_ANON_KEY=eyJ…
```

### Ce que le navigateur a le droit de charger

Le portail pose ses en-têtes sur **toute** l'origine (`mc-hub/next.config.ts`). Une application ne
les voit pas dans son propre code, et les subit intégralement. Trois conséquences à connaître
**avant** de choisir une bibliothèque, pas après :

| En-tête | Ce que cela interdit | Ce qu'on fait à la place |
|---|---|---|
| `script-src 'self' 'unsafe-inline'` | tout script venu d'un CDN ; **tout `eval`** en production | vendoriser dans `public/vendor/` |
| `img-src 'self' data:` (+ Google favicons, unavatar pour MC CRM) | images distantes | `data:` ou le seau Supabase |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | `getUserMedia` — sur toute la plateforme | `<input type="file" capture>`, qui passe par le sélecteur du système et ignore cette politique |

Le piège du `eval` n'est pas théorique : **exceljs** embarque `regenerator-runtime`, qui s'installe
par `eval` au chargement. Les six exports Excel de MC CCTP échouaient tous, à l'ouverture du module
et non à l'appel — la trace ne désignait donc jamais l'export. Le correctif tient en une ligne dans
le fichier vendorisé, et il est documenté dans `mc-cctp/public/vendor/LISEZ-MOI.md` : **une
bibliothèque retouchée à la main se note, sinon la prochaine mise à jour l'écrase en silence.**

En développement, `'unsafe-eval'` est ajouté pour le rechargement à chaud de Next. **Une
bibliothèque qui marche en local et casse en ligne, c'est presque toujours cela.**

---

## 6 · La base de données

Une seule base pour toute la plateforme (`atc-platform`), **un schéma par solution** :

| Schéma | Porté par | Particularité |
|---|---|---|
| `identity` | MC Hub | profils, applications, droits. Aucune autre application n'y écrit. |
| `sonar` | MC SONAR | les études vivent en base depuis 0048 |
| `crm` | MC CRM | identifiants fabriqués dans le navigateur — d'où R10 |
| `cctp` | MC CCTP | seule dérogation à R10 : compteurs plutôt qu'UUID |
| `catalogue` | myCatalogue | **lu par toutes les applications** — §7 |
| `parapheur` | MC PARAPHEUR | registre : une ligne ne se supprime pas, elle s'annule |

| Règle | Bon | À proscrire |
|---|---|---|
| Un schéma par solution | `crm.contacts` | `public.contacts` |
| Pas de préfixe redondant | `crm.lots` | `crm.crm_lots` |
| Pluriel, `snake_case` | `sonar.speakers` | `sonar.Speaker` |
| Nom de migration | `0018_crm_contacts_add_source.sql` | `fix.sql` |

Colonnes obligatoires sur toute table métier :

```sql
id          uuid primary key default gen_random_uuid(),
created_at  timestamptz not null default now(),
updated_at  timestamptz not null default now(),
created_by  uuid references auth.users(id)
```

**La RLS se branche sur la plateforme**, jamais sur une notion d'utilisateur propre à
l'application :

```sql
create schema crm;
grant usage on schema crm to authenticated;

-- Deux fonctions, appelées par toutes les policies : le jour où la règle
-- change, elle change à un seul endroit.
create function crm.peut_lire() returns boolean
  language sql stable security definer set search_path = identity, pg_catalog
as $$ select identity.has_app_access('crm'); $$;

create function crm.peut_ecrire() returns boolean
  language sql stable security definer set search_path = identity, pg_catalog
as $$ select coalesce(identity.app_role('crm') in ('owner','admin','editor'), false); $$;

alter table crm.contacts enable row level security;
create policy "lecture ayants droit" on crm.contacts
  for select to authenticated using (crm.peut_lire());
create policy "écriture hors lecture seule" on crm.contacts
  for all to authenticated using (crm.peut_ecrire()) with check (crm.peut_ecrire());
```

La RLS s'active **dès la création de la table**, y compris en développement. « On l'activera plus
tard » est la manière dont une table finit en production sans protection.

### Atteindre un schéma depuis l'application — la règle a changé

Deux façons coexistent sur la plateforme. **Une seule est autorisée pour une nouvelle
application**, et ce n'est pas celle qu'on lit dans les anciennes.

**Les enveloppes `public.<slug>_*` — à faire (R15).** Le schéma reste fermé ; chaque geste que
l'application a le droit de faire est une fonction dans `public`, en `security definer`, dont le
`search_path` est épinglé :

```sql
create or replace function public.parapheur_verifier(p_numero text, p_empreinte text)
returns jsonb language sql stable
        security definer set search_path = parapheur, pg_catalog
as $$ select parapheur.verifier(p_numero, p_empreinte) $$;

revoke all on function public.parapheur_verifier(text, text) from public, anon;
grant execute on function public.parapheur_verifier(text, text) to authenticated;
notify pgrst, 'reload schema';
```

Côté application : `supabase.rpc('parapheur_verifier', { … })`. Rien d'autre à cocher nulle part,
et la surface exposée est exactement la liste des fonctions écrites — pas un schéma entier dont on
espère que la RLS le couvre partout.

**Exposer le schéma dans les réglages Data API — à ne plus faire.** `catalogue` et `cctp` le sont,
et le sont bien : `supabase.schema('catalogue').from('articles')`. Mais **le geste d'exposition a
réécrit les privilèges des rôles d'API trois fois** sur cette plateforme — migrations 0014, 0032 et
0035 n'existent que pour réparer cela. Chaque fois, le symptôme est un `permission denied` sur des
objets qui n'ont rien à voir, et la cause ne ressemble pas à sa trace.

Si vous avez malgré tout à exposer un schéma, l'ordre est celui-ci, et il n'est pas commutatif :

1. **Integrations → Data API → Settings → Exposed schemas** : ajouter le schéma.
   *(Ce n'est pas « Settings → API », et surtout pas « Extra search path », qui est un autre champ.)*
2. **Exposed tables** : cocher les tables. « Automatically expose new tables » ne couvre que les
   tables créées **après** l'exposition du schéma.
3. Recharger le cache : `notify pgrst, 'reload schema';` dans une migration. Sans ça, un objet
   créé par migration reste introuvable pour l'API (`PGRST202`).
4. **Relire les privilèges d'`anon`** — c'est l'étape qu'on oublie, et c'est la seule qui coûte :

```sql
select count(*) from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = '<slug>';   -- doit valoir 0
```

Une migration poussée ne se modifie **jamais**. Corriger une erreur, c'est écrire la suivante.

---

## 7 · myCatalogue — la matière commune

Le catalogue d'articles est la seule donnée que **toutes** les applications partagent. Il a vécu
dans `cctp`, comme s'il appartenait à MC CCTP ; il n'y appartenait pas. MC SONAR décrivait les mêmes
enceintes de son côté, avec ses propres fiches, et les applications à venir les décriront encore
autrement. Un catalogue possédé par une application est un catalogue qu'on coupe à tout le monde le
jour où l'on retire un accès. Il vit donc dans son propre schéma, à égale distance de chacune
(migration 0033).

**Une nouvelle application n'a rien à créer pour s'en servir.** Elle lit. Ce qui suit est tout ce
qu'il faut en savoir.

### Ce qu'il contient

| Table | Ce qu'elle porte |
|---|---|
| `catalogue.articles` | la fiche courante — ~2 460 lignes |
| `catalogue.revisions` | un instantané `jsonb` par version, avec motif et auteur |
| `catalogue.usages` | quelles applications portent l'article (pour la fiche) |

L'identité d'un article n'est **pas** sa référence : `(equipement_type, manufacturer, reference)`,
en index unique. La référence seule ne suffit pas — « LIBRE » en désigne quatre-vingt-quatorze.

Les colonnes sont en **anglais** (`unit_price`, `manufacturer`, `average_power`…) quand tout le
reste de la plateforme est en français. C'est délibéré : renommer 2 461 lignes en même temps qu'on
les déménage, c'était deux risques dans une migration pour un gain esthétique. Le vocabulaire se
reprendra quand il ne coûtera que lui-même.

### Qui lit, qui écrit

```sql
catalogue.peut_lire()    -- accès à `catalogue` OU `cctp` OU `sonar`
catalogue.peut_ecrire()  -- `catalogue` en owner/admin/editor, ou `cctp` en owner/admin
```

**Lire le catalogue n'est pas une confidence : c'est la matière commune du travail.** Une nouvelle
application qui doit le lire s'ajoute à `catalogue.peut_lire()` par une migration d'une ligne. Ne
lui donnez pas l'écriture : tenir le catalogue est un métier, pas un effet de bord.

### La version — le point à comprendre avant d'écrire du code

Chaque article porte un `version int`. **Poser un article dans un espace inscrit la version du
moment sur la ligne d'affectation**, par déclencheur — une affectation ne peut pas naître sans dire
à quoi elle se réfère. Relire ce projet résout chaque ligne **contre sa révision** : prix,
puissances, description sont ceux du jour où le chiffrage a été fait.

Conséquence, et c'est le cœur du mécanisme : **mettre à jour un article n'affecte rien.** La fiche
montre qui s'en sert et à quelle version ; on choisit ensuite les projets qui reçoivent la nouvelle,
et chaque poussée laisse une trace dans le journal du projet.

> L'épinglage se fait **par utilisation**, jamais par application. Les migrations 0040 et 0041
> épinglaient par application — « MC CCTP voit la version 2 » — ce qui rendait le mécanisme
> inutilisable : un projet livré en juin et un projet ouvert ce matin voyaient la même chose. 0047
> a corrigé le grain. Si votre application stocke des utilisations d'articles, elle porte une
> colonne `article_version` et elle lit **par cette version**.

MC SONAR fait exception, et c'est assumé : ses études ne sont pas en base, aucune ligne ne dit
« l'étude X utilise l'enceinte Y ». Il lit donc la version courante, et la fiche le dit en toutes
lettres plutôt que de laisser croire le contraire.

### Les portes

`catalogue` est exposé au Data API — c'est l'ancien régime (§6), on ne l'en retire pas. La lecture
directe est donc possible, et c'est ce que fait MC CCTP :

```ts
const { data } = await supabase.schema('catalogue').from('articles')
  .select('id, manufacturer, reference, designation, unit_price, version')
  .eq('manufacturer', 'Bose').order('designation')
```

Tout ce qui n'est pas une simple lecture passe par une enveloppe :

| Fonction | Ce qu'elle fait |
|---|---|
| `catalogue_filtres()` | les valeurs distinctes pour les listes déroulantes |
| `catalogue_fiche(p_article)` | la fiche complète : article, usages, historique |
| `catalogue_articles_aux_versions(p_paires jsonb)` | **la lecture d'un chiffrage** : résout chaque `{id, version}` contre sa révision |
| `catalogue_pousser(p_article, p_projets)` | applique la version courante aux projets choisis |
| `catalogue_definir_presets(p_article, p_cles)` | les valeurs préréglées d'un article |

`catalogue_articles_aux_versions` est celle qui compte. **Si votre application affiche un chiffrage
sans passer par elle, elle affiche les prix d'aujourd'hui sur un devis d'hier.**

### L'état des données au 30/08/2026

À connaître avant de bâtir un écran dessus : **444 articles sans prix** (dont 384 enceintes),
**2 051 sans photo**, 64 gardés « au doute ». Un écran qui suppose ces champs remplis montrera
surtout des vides. Et les études SONAR d'avant le 29/08/2026 ne lient aucun article — un rattrapage
par nom de modèle reste possible, il n'a pas été fait.

---

## 8 · Ajouter une application

Six existent. La septième suit ces neuf étapes, **dans cet ordre**. Chacune a été payée au moins
une fois par une application antérieure ; l'ordre n'est pas indicatif.

**1 · Le dépôt.** Sous le compte personnel, jamais sous l'organisation (§3) :

```bash
gh repo create tontondubled/mc-<slug> --private --clone
```

**2 · La copie.** Partir de `mc-catalogue` ou `mc-parapheur` : ce sont les deux plus récentes, et
les seules déjà écrites avec les enveloppes `public.*`. Douze fichiers suffisent — `next.config.ts`
(`basePath: '/<slug>'`), `vercel.json`, `src/middleware.ts`, les routes d'API, `public/app.html`.

**3 · Le middleware**, littéral, avec l'entrée `'/'` (R03, R04) :

```ts
export default atcMiddleware("<slug>");
export const config = { matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"] };
```

**4 · La base**, dans `atc-db`, une migration qui fait les cinq choses ensemble :

```sql
create schema <slug>;
grant usage on schema <slug> to authenticated;

create function <slug>.peut_lire()   returns boolean language sql stable security definer
  set search_path = identity, pg_catalog as $$ select identity.has_app_access('<slug>'); $$;
create function <slug>.peut_ecrire() returns boolean language sql stable security definer
  set search_path = identity, pg_catalog
  as $$ select coalesce(identity.app_role('<slug>') in ('owner','admin','editor'), false); $$;

-- … les tables, RLS activée DÈS LA CRÉATION, policies branchées sur les deux fonctions …
-- … les enveloppes public.<slug>_* (R15, §6) …

insert into identity.apps (slug, name, tagline, url, status, sort_order)
values ('<slug>', 'MC X', '…', 'https://my.atrait-consulting.com/<slug>', 'hidden', 60);

notify pgrst, 'reload schema';
```

`status = 'hidden'` jusqu'à la mise en service : une tuile qui mène à un 404 fait perdre confiance
dans le portail entier.

**5 · Vercel, relié à GitHub tout de suite** (R14). C'est l'étape la plus rentable et la plus
souvent remise à plus tard : cinq projets sur six ne le sont pas, et un `git push` y réussit sans
rien déployer. Puis les deux variables du §5 (voir §9 pour la commande).

**6 · Le relais.** Ajouter `<slug>=https://mc-<slug>.vercel.app` à `ATC_APP_ORIGINS` sur `mc-hub`,
**et redéployer `mc-hub`** — la variable est lue à la compilation. Sans ce redéploiement,
`/<slug>` répond 404 et tout le reste semble cassé.

**7 · La charte** (R16) :

```bash
node atc-shared/theme/appliquer.mjs mc-<slug>/public/app.html
```

Le script pose les jetons et le rail. **Il ne fait pas le reste**, et le reste se voit : les
libellés, les émojis employés comme puces, les boutons dont l'émoji était le seul contenu. Ouvrez
la page à côté d'une autre application avant de dire que la charte est appliquée — ce jugement ne
se rend pas sur le CSS.

**8 · Le droit et la mise en service.** Se donner l'accès sur `/admin`, vérifier avec **Voir** ce
que verra quelqu'un qui ne l'a pas, puis passer l'application en `live`.

**9 · La vérification du §11.** Elle n'est pas facultative ; c'est elle qui distingue « ça marche
chez moi » de « c'est livré ».

### Ce qu'il ne faut pas faire

- **Créer une table d'utilisateurs** (R09). On stocke un `user_id uuid` et on résout par `/api/moi`.
- **Inventer un rôle** (R07). Quatre pour toute la plateforme.
- **Recopier le catalogue.** Une application qui a besoin d'articles lit `catalogue` (§7). La
  dernière qui s'est constitué ses propres fiches a produit 420 doublons qu'il a fallu fusionner.
- **Mettre la donnée métier dans `public`** (R08). `public` ne porte que les enveloppes.

---

## 9 · Déployer

Branche `feat/…` ou `fix/…` → demande de fusion → une relecture → fusion sur `main` → Vercel
déploie.

Variables sur Vercel — **le défaut est le bon** pour tout ce qui n'est pas secret :

```bash
vercel env add NEXT_PUBLIC_ATC_ID_URL production
vercel env add CRM_CLE_CONNECTEURS production --sensitive   # un vrai secret
```

Une variable ordinaire se relit ; une variable `--sensitive` ne se relit **jamais**, pas même par
vous. C'est ce qu'on veut d'une clé, et c'est ce qu'on ne veut pas d'une URL : impossible sinon de
vérifier une valeur mal collée.

> **`--type config` n'existe plus.** Le drapeau figurait ici et la CLI le refuse désormais
> (`unknown or unexpected option`, constaté sur la 50.39.0). Le comportement qu'il demandait est
> devenu le comportement par défaut ; c'est `--sensitive` qui fait l'inverse. Une instruction
> périmée dans un document qui « fait foi » coûte plus cher qu'une instruction absente.

Épingler la dépendance partagée sur un **tag**, jamais sur `main` :

```json
"@atc/auth": "https://github.com/atrait-consulting/atc-shared/archive/refs/tags/v1.0.4.tar.gz"
```

Le comportement d'authentification de votre application ne doit pas changer parce que quelqu'un a
fusionné une PR ailleurs.

---

## 10 · Les pièges déjà payés

Chacun a coûté du temps une fois. Il n'a pas à en coûter deux.

**Un 504 `MIDDLEWARE_INVOCATION_TIMEOUT` sur des pages qui marchaient hier.** Le middleware Next
s'exécute dans l'Edge Runtime. Depuis ce runtime, un appel qui atteint réellement le service
d'authentification Supabase **reste sans réponse** — mesuré quatre fois sur quatre depuis `lhr1`,
quand le même appel répond en 110 ms depuis un runtime Node, et quand `example.com` répond en
105 ms depuis l'Edge. Le middleware attend, Vercel le tue, l'utilisateur reçoit un 504 brut.

Le piège est que la cause ne ressemble pas à sa trace : on soupçonne d'abord le hook JWT, la durée
du jeton, une rafale de rafraîchissements. Un garde-temps sur l'appel supprime bien le 504 — et
renvoie tout le monde vers l'écran de connexion au bout de quatre secondes. Le symptôme change de
forme, pas de nature.

*Conséquence, et c'est une règle :* **le middleware ne fait aucun appel réseau.** Il lit le cookie,
il y lit le claim `mc`, il tranche. Le renouvellement du jeton part vers `/auth/rafraichir`, côté
portail, en runtime Node — une fois par session au lieu d'une fois par requête.

*Diagnostic, si le doute revient :* déployer deux routes identiques, l'une par défaut, l'autre avec
`export const runtime = "edge"`, chacune chronométrant `fetch(<ref>.supabase.co/auth/v1/settings)`
avec `AbortSignal.timeout(3000)`. Les deux colonnes se comparent en une lecture.


**« Connexion en cours… » et rien ne se passe.** Les `process.env.NEXT_PUBLIC_*` s'écrivent en
toutes lettres. Next les remplace à la compilation, mais seulement quand l'expression est
littérale : un `process.env[nom]` dynamique vaut `undefined` dans le navigateur. Les pages se
rendent parfaitement pendant que le moindre clic ne fait rien.
*Vérification :* `curl -s <url>/_next/static/chunks/app/…/page.js | grep -c "<ref>.supabase.co"`.

**« permission denied for schema X » alors que les droits sont bons.** Le client Supabase du
navigateur doit être `createBrowserClient` de `@supabase/ssr`. Le `createClient` ordinaire ignore
les cookies : toutes les requêtes partent en anonyme, et le message accuse les privilèges.

**Une clé qui passe tous les contrôles et casse quand même.** Copiée depuis l'affichage **masqué**
de Vercel, elle contient des puces `•` (U+2022). Bonne longueur, commence par `eyJ`, et échoue à
la construction de l'en-tête HTTP : *Cannot convert argument to a ByteString… value of 8226*.

**`invalid input syntax for type uuid`.** L'application fabrique ses identifiants ailleurs qu'avec
`crypto.randomUUID()`. Corrigez à la source ; une couche de traduction ferait diverger
l'identifiant d'un enregistrement selon qu'on le regarde en local ou en base.

**`Unknown identifier` au build.** `config.matcher` doit être un littéral (R04).

**La racine de l'application répond 200 à un inconnu.** Le motif d'exclusion ne capture pas `/`
sous un `basePath`. Ajoutez l'entrée `'/'`.

**`violates foreign key constraint`.** Des écritures parties en parallèle : l'enfant est arrivé
avant le parent. Ordre des dépendances à l'écriture, ordre inverse à la suppression (R11).

**Une page sans CSS ni JavaScript, toutes les ressources en 404.** `npm run build` a été lancé
pendant que `next dev` tournait : le build de production a écrasé `.next`. Arrêtez le serveur,
supprimez `.next`, relancez.

**Le build échoue au clone d'une dépendance.** npm normalise toute dépendance GitHub en
`git+ssh://` dans le lockfile. Une machine de build n'a pas de clé SSH. D'où l'archive HTTPS
taguée du §9.

**Vercel refuse de déployer un commit.** GitHub ne rattache pas l'adresse de l'auteur à un compte.
Committez avec une adresse vérifiée sur votre compte GitHub.

**`MIDDLEWARE_INVOCATION_TIMEOUT` (504).** Le hook JWT n'est pas activé côté Supabase : le
middleware interroge la base à **chaque** requête, et une page qui charge trente ressources
déclenche trente allers-retours. Depuis `v1.0.4`, les appels sont plafonnés à 4 s et renvoient
vers l'écran de connexion plutôt que d'expirer — mais le remède est d'activer le hook.

**Une fonctionnalité qui a cessé de marcher sans que rien ne le dise.** Une route validait le
format d'un identifiant par une expression régulière recopiée d'une migration. La migration
suivante a changé le format ; la route a continué de refuser, poliment, et le client avalait
l'échec pour ne pas alarmer sur un détail. Résultat : plus aucune vignette au registre de
MC PARAPHEUR pendant des jours, sans un seul message d'erreur nulle part.
*Deux règles en sortent.* **R18** : ce que la base décide, l'application ne le redit pas. Et : un
`catch {}` vide est une décision, pas un filet — s'il est justifié, il porte un commentaire qui dit
pourquoi, et l'échec se voit ailleurs.

**Un export qui échoue à l'ouverture du module, jamais à l'appel.** `exceljs` installe
`regenerator-runtime` par `eval`. La CSP de production l'interdit (§5) ; les six exports Excel de
MC CCTP tombaient donc tous, et la trace ne désignait jamais l'export. En développement,
`'unsafe-eval'` est autorisé : **ça marchait en local**.

**Un `$?` qui ment.** `npm run build | tail -3` renvoie le code de sortie de `tail`, pas du build.
Un build cassé s'annonce alors comme réussi. `${PIPESTATUS[0]}`, ou pas de tuyau.

**Deux dessins du même objet finissent toujours par diverger.** L'aperçu du tampon dans le
navigateur et son tracé dans le PDF ont divergé trois fois — libellés en capitales d'un côté et pas
de l'autre, code placé à droite ici et au centre là. La parade n'est pas la vigilance : c'est un
banc qui **découpe le code de production** et le rejoue hors du navigateur
(`mc-parapheur/essai/preuve/preuve.mjs`). Et il le découpe **par contenu**, jamais par numéros de
ligne : la première version les avait codés en dur, une seule modification de la route les a
périmés.

**Une mesure faite dans un onglet en arrière-plan ne vaut rien.** Chrome n'y déclenche aucune frame
d'animation : tout ce qui passe par `requestAnimationFrame` s'arrête sans erreur, et le rendu de
pdf.js reste bloqué indéfiniment. Le symptôme ressemble exactement à un bug applicatif — j'ai livré
un correctif pour un défaut qui n'existait pas. **Vérifier `document.visibilityState` avant de
conclure quoi que ce soit d'une mesure dans le navigateur.**

**Une contrainte physique qu'aucun réglage ne contourne.** Un code QR ne descend pas sous
21 modules, et un lecteur décroche sous 0,4 mm par module : 26 pt de côté, quelle que soit la taille
du tampon. Quand une demande bute sur une limite de ce genre, la calculer et la dire vaut mieux que
l'approcher — un carré illisible ressemble à un code QR, et n'en est pas un.

---

## 11 · « Terminé », ça veut dire quoi

Une application MC n'est pas livrée parce qu'elle fonctionne sur votre poste. Elle l'est quand
les huit points suivants sont vrais.

- [ ] Elle répond sous `my.atrait-consulting.com/<slug>`, relayée par le portail.
- [ ] **Une tuile mène à elle depuis le portail** : `identity.apps` la porte en `live`. Une
      application en ligne sans lien est une application que personne ne trouve.
- [ ] `atcMiddleware` est en place ; aucun écran de connexion ne subsiste.
- [ ] La connexion est vérifiée depuis un poste **et** depuis un iPhone.
- [ ] Un collaborateur sans droit atterrit sur la page de refus, pas sur un 403 nu.
- [ ] Aucune route, aucun fichier statique n'est accessible en navigation privée — **y compris la
      racine de l'application**. À éprouver avec un cookie forgé : chaque route doit répondre 401.
- [ ] `anon` n'a **aucun** droit sur le schéma, et le seau privé répond « Bucket not found » à une
      requête anonyme.
- [ ] Le schéma et ses policies ont été relus en demande de fusion sur `atc-db`.
- [ ] **Le parcours principal a été fait en entier, dans le navigateur, avec une vraie session.**
      Pas « les pages s'affichent » : le geste complet, du début à la fin, sur une donnée jetable.
- [ ] La charte tient la comparaison côte à côte avec une autre application — pas seulement dans
      les jetons CSS.
- [ ] Le README dit comment lancer, quelles variables existent, où sont les données.
- [ ] Le projet Vercel est **relié à GitHub**, et le déploiement se fait par fusion.

---

*Une question, une exception à demander, un accès manquant :
[jberteault@atrait-consulting.com](mailto:jberteault@atrait-consulting.com)*
