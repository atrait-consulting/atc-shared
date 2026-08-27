/**
 * Client Supabase côté serveur (Server Components, Route Handlers, Server Actions)
 * et gardes d'accès.
 */
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { HUB, idAnonKey, idUrl } from './config.js'
import type { McRole } from './jwt.js'

export async function createAtcServerClient() {
  const cookieStore = await cookies()

  return createServerClient(idUrl(), idAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Appelé depuis un Server Component : les cookies sont en lecture seule.
          // Le rafraîchissement du jeton est assuré par le middleware.
        }
      },
    },
  })
}

/** L'utilisateur connecté, vérifié auprès de Supabase. `null` si pas de session. */
export async function getAtcUser() {
  const supabase = await createAtcServerClient()
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data.user
}

/**
 * Contrôle de niveau 2 : interroge la base, pas le jeton.
 *
 * À appeler sur toute écriture et toute donnée sensible. Une révocation prend
 * alors effet immédiatement, sans attendre l'expiration du JWT.
 */
export async function hasAppAccess(appSlug: string): Promise<boolean> {
  const supabase = await createAtcServerClient()
  const { data, error } = await supabase.rpc('has_app_access', { p_app: appSlug })
  return !error && data === true
}

/** Le rôle de l'utilisateur courant sur l'application, ou `null`. */
export async function appRole(appSlug: string): Promise<McRole | null> {
  const supabase = await createAtcServerClient()
  const { data, error } = await supabase.rpc('app_role', { p_app: appSlug })
  return error ? null : ((data as McRole | null) ?? null)
}

/**
 * Garde de page ou de Server Action.
 * Renvoie vers le portail si la personne n'est pas connectée, vers la page de
 * refus si elle l'est mais n'a pas le droit d'entrer ici.
 */
export async function requireApp(appSlug: string): Promise<void> {
  const user = await getAtcUser()
  if (!user) redirect(`${HUB.login}?app=${encodeURIComponent(appSlug)}`)
  if (!(await hasAppAccess(appSlug))) redirect(`${HUB.refus}?app=${appSlug}`)
}

/** URL de déconnexion : un formulaire POST, jamais un `signOut()` côté client. */
export const signOutUrl = (): string => HUB.signOut

/** Mémorise l'application ouverte, pour que la racine y renvoie la prochaine fois. */
export async function touchLastApp(appSlug: string): Promise<void> {
  const supabase = await createAtcServerClient()
  await supabase.rpc('touch_last_app', { p_app: appSlug })
}
