/**
 * Le middleware que chaque application MC monte tel quel.
 *
 *   import { atcMiddleware } from '@atc/auth/middleware'
 *   export default atcMiddleware('sonar')
 *   export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
 *
 * Il fait trois choses, dans cet ordre :
 *   1. rafraîchit le cookie de session (sinon la session expire au bout d'un
 *      quart d'heure alors que l'utilisateur est encore là) ;
 *   2. renvoie vers le portail si personne n'est connecté ;
 *   3. vérifie que la personne a bien le droit d'entrer dans CETTE application.
 *
 * L'étape 3 lit le claim `mc` du jeton — aucun appel à la base. Si le hook JWT
 * n'est pas encore activé côté Supabase, elle bascule automatiquement sur un
 * appel `has_app_access`, plus lent mais toujours juste.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookieDomainFor, hubUrl, idAnonKey, idUrl } from './config.js'
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
    const domain = cookieDomainFor(request.headers.get('host'))

    const supabase = createServerClient(idUrl(), idAnonKey(), {
      cookieOptions: { domain, path: '/', sameSite: 'lax', secure: true },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options: opts } of list) {
            response.cookies.set(name, value, { ...opts, domain, path: '/' })
          }
        },
      },
    })

    // `getUser()` valide le jeton auprès de Supabase : c'est la seule preuve
    // d'identité qu'on accepte. Tout ce qui suit s'appuie dessus.
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      return NextResponse.redirect(loginUrl(request, appSlug))
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
      return NextResponse.redirect(`${hubUrl()}/acces?app=${encodeURIComponent(appSlug)}`)
    }

    return response
  }
}

function loginUrl(request: NextRequest, appSlug: string): string {
  const target = new URL(request.url)
  const params = new URLSearchParams({ app: appSlug, next: target.pathname + target.search })
  return `${hubUrl()}/login?${params.toString()}`
}
