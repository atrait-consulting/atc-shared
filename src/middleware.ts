/**
 * Le middleware que chaque application MC monte tel quel.
 *
 *   import { atcMiddleware } from '@atc/auth/middleware'
 *   export default atcMiddleware('sonar')
 *   export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
 *
 * Il fait trois choses, dans cet ordre :
 *   1. rafraîchit le cookie de session ;
 *   2. renvoie vers le portail si personne n'est connecté ;
 *   3. vérifie que la personne a bien le droit d'entrer dans CETTE application.
 *
 * L'étape 3 lit le claim `mc` du jeton — aucun appel à la base. Si le hook JWT
 * n'est pas activé côté Supabase, elle bascule sur `has_app_access`, plus lent
 * mais toujours juste.
 *
 * Les redirections sont RELATIVES : sur une origine unique, elles restent
 * naturellement sur l'hôte courant, en production comme sur localhost. Il n'y
 * a plus une seule URL de portail à configurer.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { HUB, idAnonKey, idUrl } from './config.js'
import { readMcClaims } from './jwt.js'

export interface AtcMiddlewareOptions {
  /** Chemins laissés ouverts (santé, webhooks signés, assets publics). */
  publicPaths?: string[]
}

const alwaysPublic = ['/api/health']

export function atcMiddleware(appSlug: string, options: AtcMiddlewareOptions = {}) {
  const publicPaths = [...alwaysPublic, ...(options.publicPaths ?? [])]

  return async function middleware(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl
    if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return NextResponse.next()
    }

    let response = NextResponse.next({ request })

    const supabase = createServerClient(idUrl(), idAnonKey(), {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options: opts } of list) {
            response.cookies.set(name, value, opts)
          }
        },
      },
    })

    // `getUser()` valide le jeton auprès de Supabase : c'est la seule preuve
    // d'identité qu'on accepte. Tout ce qui suit s'appuie dessus.
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return NextResponse.redirect(new URL(loginPath(request, appSlug), request.url))
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const claims = readMcClaims(sessionData.session?.access_token)

    let allowed: boolean
    if (claims.present) {
      allowed = claims.active && Boolean(claims.grants[appSlug])
    } else {
      const { data } = await supabase.rpc('has_app_access', { p_app: appSlug })
      allowed = data === true
    }

    if (!allowed) {
      const refus = `${HUB.refus}?app=${encodeURIComponent(appSlug)}`
      return NextResponse.redirect(new URL(refus, request.url))
    }

    return response
  }
}

/**
 * `basePath` retire le préfixe de `pathname` : une application montée sous
 * /sonar voit « /app.html ». Le portail, lui, vit à la racine de l'origine et
 * renverrait donc vers « /app.html », qui n'existe pas chez lui. On remet le
 * préfixe pour que le retour après connexion tombe au bon endroit.
 */
function loginPath(request: NextRequest, appSlug: string): string {
  const path = request.nextUrl.pathname
  const prefixe = `/${appSlug}`
  const complet = path === prefixe || path.startsWith(`${prefixe}/`) ? path : prefixe + path

  const params = new URLSearchParams({
    app: appSlug,
    next: complet + request.nextUrl.search,
  })
  return `${HUB.login}?${params.toString()}`
}
