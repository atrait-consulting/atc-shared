# Contrat d'intégration MC

**Plateforme interne ATRAIT Consulting — https://my.atrait-consulting.com**

À lire avant d'écrire la première ligne d'une application MC. Ce document est la référence :
si un autre écrit dit le contraire, c'est celui-ci qui fait foi.

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
navigateur ───────▶  my.atrait-consulting.com  ──── rewrites ────▶  déploiements Vercel
                     │  /login  /portail  /admin                    mc-sonar   (basePath /sonar)
                     │  /sonar/*  /crm/*  relayés                   mc-crm     (basePath /crm)
                     ▼
                Supabase « atc-platform »
                identity.*  ·  sonar.*  ·  crm.*
```

Ce choix d'une origine unique n'est pas cosmétique : il supprime tout partage de cookie entre
hôtes, et avec lui la famille de pannes qui va avec — session invisible sur iPhone, cookie en
double, boucle de connexion inexplicable. **Il n'y a aucun domaine de cookie à configurer nulle
part.** Si vous en voyez un dans du code, c'est un vestige : supprimez-le.

Deux niveaux de contrôle, toujours les deux :

1. Le **middleware** lit le droit dans le jeton, et **ne fait aucun appel réseau** — voir §8,
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

| Rôle plateforme | MC SONAR | MC CRM |
|---|---|---|
| Responsable / Administrateur | tous droits | `admin` — gère aussi les réglages |
| Contributeur | tous droits | `membre` — crée et modifie |
| Lecture seule | consultation | `lecture` — ne modifie rien |
| `—` | tuile grisée | tuile grisée |

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
| `mc-hub`, `mc-sonar`, `mc-crm` | compte personnel, privés |
| `atc-db` | organisation `atrait-consulting`, privé — jamais déployé |
| `atc-shared` | organisation, **public** — le build doit pouvoir l'installer |

---

## 4 · Les règles

Les trois en gras font échouer la revue sans discussion.

| | |
|---|---|
| **R01** | **Aucune application ne gère l'authentification.** Pas de page de connexion, pas de cookie maison, pas de mot de passe, pas de `SESSION_SECRET`. |
| R02 | L'application déclare `basePath: '/<slug>'` et n'est jamais servie ailleurs que sous ce chemin. |
| R03 | `src/middleware.ts` contient `atcMiddleware('<slug>')`, et rien d'autre. |
| R04 | Le `matcher` est **recopié en littéral** et contient l'entrée `'/'`. Voir §5 — Next refuse un identifiant importé, et sans `'/'` la racine se sert sans session. |
| **R05** | **Deux niveaux de contrôle.** Le middleware ne suffit pas : toute écriture rappelle `hasAppAccess()`. |
| R06 | Le client Supabase du navigateur est `createBrowserClient` de `@supabase/ssr`. Le client ordinaire ignore les cookies et parle en anonyme. |
| R07 | Quatre rôles pour toute la plateforme : `owner`, `admin`, `editor`, `viewer`. Une application peut en ignorer un, jamais en inventer un cinquième. |
| R08 | Chaque solution a son schéma PostgreSQL. Jamais de table métier dans `public`. |
| R09 | Aucune application ne crée de table d'utilisateurs. On stocke un `user_id uuid` et on résout le profil via `/api/moi`. |
| R10 | Les identifiants sont des **UUID**. Les colonnes sont typées `uuid` : un identifiant maison est refusé à l'écriture. |
| R11 | Les écritures groupées suivent l'ordre des dépendances, les suppressions l'ordre inverse. |
| R12 | Toute migration passe par une PR sur `atc-db`. Aucun `supabase db push` depuis un dépôt applicatif, aucun DDL à la main dans le tableau de bord. |
| **R13** | **Aucun secret en `NEXT_PUBLIC_*`, aucun `.env` versionné.** La clé `service_role` ne quitte jamais le serveur et ne s'importe jamais depuis un composant `"use client"`. |
| R14 | Déployer, c'est fusionner sur `main`. Ce qui est en ligne correspond toujours à un commit relu. |

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

---

## 6 · La base de données

Une seule base pour toute la plateforme, **un schéma par solution** : `identity`, `sonar`, `crm`.

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

### Exposer un schéma à l'API — trois étapes, dans cet ordre

Sans elles, PostgREST refuse tout, avec des messages qui désignent le mauvais coupable.

1. **Integrations → Data API → Settings → Exposed schemas** : ajouter le schéma.
   *(Ce n'est pas « Settings → API », et surtout pas « Extra search path », qui est un autre champ.)*
2. **Exposed tables** : cocher les tables. « Automatically expose new tables » ne couvre que les
   tables créées **après** l'exposition du schéma.
3. Recharger le cache : `notify pgrst, 'reload schema';` dans une migration. Sans ça, un objet
   créé par migration reste introuvable pour l'API (`PGRST202`).

Une migration poussée ne se modifie **jamais**. Corriger une erreur, c'est écrire la suivante.

---

## 7 · Déployer

Branche `feat/…` ou `fix/…` → demande de fusion → une relecture → fusion sur `main` → Vercel
déploie.

Variables sur Vercel — utiliser `--type config` pour tout ce qui n'est pas secret :

```bash
echo "https://<ref>.supabase.co" | vercel env add NEXT_PUBLIC_ATC_ID_URL production --type config
```

Sans ce drapeau, la valeur est stockée en *Secret* et devient **impossible à relire**, y compris
pour vous : impossible de vérifier une clé mal collée.

Épingler la dépendance partagée sur un **tag**, jamais sur `main` :

```json
"@atc/auth": "https://github.com/atrait-consulting/atc-shared/archive/refs/tags/v1.0.4.tar.gz"
```

Le comportement d'authentification de votre application ne doit pas changer parce que quelqu'un a
fusionné une PR ailleurs.

---

## 8 · Les pièges déjà payés

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
taguée du §7.

**Vercel refuse de déployer un commit.** GitHub ne rattache pas l'adresse de l'auteur à un compte.
Committez avec une adresse vérifiée sur votre compte GitHub.

**`MIDDLEWARE_INVOCATION_TIMEOUT` (504).** Le hook JWT n'est pas activé côté Supabase : le
middleware interroge la base à **chaque** requête, et une page qui charge trente ressources
déclenche trente allers-retours. Depuis `v1.0.4`, les appels sont plafonnés à 4 s et renvoient
vers l'écran de connexion plutôt que d'expirer — mais le remède est d'activer le hook.

---

## 9 · « Terminé », ça veut dire quoi

Une application MC n'est pas livrée parce qu'elle fonctionne sur votre poste. Elle l'est quand
les huit points suivants sont vrais.

- [ ] Elle répond sous `my.atrait-consulting.com/<slug>`, relayée par le portail.
- [ ] `atcMiddleware` est en place ; aucun écran de connexion ne subsiste.
- [ ] La connexion est vérifiée depuis un poste **et** depuis un iPhone.
- [ ] Un collaborateur sans droit atterrit sur la page de refus, pas sur un 403 nu.
- [ ] Aucune route, aucun fichier statique n'est accessible en navigation privée — **y compris la
      racine de l'application**.
- [ ] Le schéma et ses policies ont été relus en demande de fusion sur `atc-db`.
- [ ] Le README dit comment lancer, quelles variables existent, où sont les données.
- [ ] Le déploiement se fait par fusion, jamais depuis un poste.

---

*Une question, une exception à demander, un accès manquant :
[jberteault@atrait-consulting.com](mailto:jberteault@atrait-consulting.com)*
