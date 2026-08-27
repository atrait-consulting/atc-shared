/**
 * Lecture des droits portés par le jeton de session.
 *
 * Le hook `identity.custom_access_token_hook` (migration 0003) injecte dans le
 * JWT :
 *   mc        : { "sonar": "admin", "cctp": "viewer" }
 *   mc_active : le compte est-il toujours actif
 *   mc_owner  : accès à la console d'administration
 *
 * On ne décode ce jeton qu'APRÈS l'avoir fait valider par Supabase
 * (`getUser()`), jamais comme unique preuve d'identité.
 */

export type McRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface McClaims {
  grants: Record<string, McRole>
  active: boolean
  owner: boolean
  /** Faux si le hook JWT n'est pas encore activé côté Supabase. */
  present: boolean
}

const empty: McClaims = { grants: {}, active: false, owner: false, present: false }

export function readMcClaims(accessToken: string | null | undefined): McClaims {
  if (!accessToken) return empty

  const segment = accessToken.split('.')[1]
  if (!segment) return empty

  try {
    // `atob`, pas `Buffer` : le middleware Next tourne sur le runtime Edge,
    // où Buffer n'existe pas.
    const binary = atob(segment.replace(/-/g, '+').replace(/_/g, '/'))
    const json = decodeURIComponent(
      Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    )
    const payload = JSON.parse(json) as Record<string, unknown>

    if (!('mc' in payload)) return empty

    return {
      grants: (payload.mc ?? {}) as Record<string, McRole>,
      active: payload.mc_active === true,
      owner: payload.mc_owner === true,
      present: true,
    }
  } catch {
    return empty
  }
}
