# @atc/auth — socle d'authentification des applications MC

Le paquet qu'aucune application ne réécrit. Il porte le client Supabase, le middleware,
les gardes serveur et la charte graphique commune.

## Installation

```bash
npm install "@atc/auth@github:atrait-consulting/atc-shared#v1.0.0"
```

On épingle toujours un tag, jamais `main` : une application ne doit pas changer de comportement
d'authentification parce que quelqu'un a mergé une PR ailleurs.

## Variables d'environnement

```
NEXT_PUBLIC_ATC_ID_URL=https://<ref>.supabase.co
NEXT_PUBLIC_ATC_ID_ANON_KEY=...
NEXT_PUBLIC_ATC_COOKIE_DOMAIN=.atrait-consulting.com
NEXT_PUBLIC_MC_HUB_URL=https://mc.atrait-consulting.com
```

En local, laisser `NEXT_PUBLIC_ATC_COOKIE_DOMAIN` vide : le cookie devient propre à `localhost`.

## Protéger une application — tout le code nécessaire

`src/middleware.ts` :

```ts
import { atcMiddleware } from '@atc/auth/middleware'

export default atcMiddleware('sonar')

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

C'est tout. Pas de page `/login`, pas de cookie maison, pas de `SESSION_SECRET`.

## Les deux niveaux de contrôle

Le middleware lit les droits dans le jeton : rapide, sur chaque requête, aucun appel à la base.
Mais un jeton reste valide jusqu'à son expiration (15 min). **Toute écriture et toute donnée
sensible rappelle donc la base** :

```ts
import { requireApp, hasAppAccess, appRole } from '@atc/auth/server'

export default async function Page() {
  await requireApp('sonar')          // redirige vers le portail ou la page de refus
  // …
}

export async function updateProject(input: FormData) {
  'use server'
  if (!(await hasAppAccess('sonar'))) return { ok: false, message: 'Accès refusé.' }
  if ((await appRole('sonar')) === 'viewer') return { ok: false, message: 'Lecture seule.' }
  // …
}
```

Ne jamais `throw` dans une Server Action : retourner `{ ok: false, message }`.

## Ce que le paquet expose

| Import | Contenu |
|---|---|
| `@atc/auth` | `tokens`, `readMcClaims`, `cookieDomainFor`, `hubUrl`, types |
| `@atc/auth/client` | `createAtcBrowserClient()` |
| `@atc/auth/server` | `createAtcServerClient()`, `getAtcUser()`, `hasAppAccess()`, `appRole()`, `requireApp()`, `signOutUrl()` |
| `@atc/auth/middleware` | `atcMiddleware(slug, { publicPaths })` |
| `@atc/auth/tokens` | la charte seule, sans dépendance Supabase |

## Le piège des variables d'environnement

Dans ce paquet, les `process.env.NEXT_PUBLIC_*` s'écrivent **en toutes lettres**, jamais via une
variable :

```ts
const ID_URL = process.env.NEXT_PUBLIC_ATC_ID_URL   // ✅ substitué à la compilation
const v = process.env[name]                          // ❌ undefined dans le navigateur
```

Next remplace ces expressions à la compilation, mais seulement quand elles sont littérales. Un accès
dynamique fonctionne côté serveur — où `process.env` existe vraiment — et vaut `undefined` côté
client. La panne est déroutante : les pages se rendent parfaitement pendant que le moindre clic ne
fait rien, sans message. Vérification rapide :

```bash
curl -s localhost:3210/_next/static/chunks/app/login/page.js | grep -c "<votre-ref>.supabase.co"
```

Zéro signifie que rien n'a été inliné.

## Deux pièges déjà payés (Novasphere)

1. **La session se pose par en-tête HTTP `Set-Cookie`, jamais par `document.cookie`.**
   iOS Safari (ITP) rejette le second : l'utilisateur saisit le bon code, reste sur le login,
   et aucun message n'explique pourquoi. Le middleware et les route handlers de ce paquet
   posent toujours les cookies sur la réponse.
2. **Le domaine du cookie doit être cohérent partout.** Un poste qui a connu deux configurations
   se retrouve avec deux cookies de session : le périmé masque le frais et la boucle de login
   paraît inexplicable. `cookieDomainFor()` centralise la règle, et le callback du portail purge
   les anciens cookies host-only.

## Déconnexion

```tsx
import { signOutUrl } from '@atc/auth/server'

<form action={signOutUrl()} method="post">
  <button type="submit">Déconnexion</button>
</form>
```

Un POST vers le portail, pas un `signOut()` côté client — sinon la session survit sur les autres
sous-domaines.
