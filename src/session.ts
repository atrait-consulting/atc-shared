import type { NextRequest } from 'next/server'

/**
 * Lire la session depuis le cookie, sans appeler personne.
 *
 * Le middleware Next s'exécute dans l'Edge Runtime. Or depuis ce runtime, tout
 * appel qui atteint réellement le service d'authentification Supabase reste
 * sans réponse : mesuré 4 fois sur 4 depuis lhr1, quand le même appel répond
 * en 110 ms depuis un runtime Node. Le middleware attendait donc jusqu'à ce
 * que Vercel le tue, et l'utilisateur recevait un 504 brut.
 *
 * D'où ce module. Le middleware décide à partir du cookie seul — c'est
 * précisément ce pour quoi le claim `mc` a été introduit.
 *
 * Ce module ne vérifie PAS la signature du jeton, et n'a pas à le faire.
 * Rien n'est servi sur la foi de cette lecture : chaque page revalide la
 * session côté serveur (`getAtcUser`), et chaque écriture repasse par
 * `hasAppAccess` puis par la RLS avec le vrai jeton. Un cookie forgé n'ouvre
 * donc aucune donnée — il obtient une page qui échoue. Le middleware aiguille,
 * il n'autorise pas.
 */

export interface SessionCookie {
  accessToken: string
  /** Instant d'expiration du jeton, en secondes epoch. */
  expireLe: number
}

/** Marge avant expiration en deçà de laquelle on part se faire renouveler. */
export const MARGE_EXPIRATION_S = 60

export function readSessionCookie(
  request: NextRequest,
  projectUrl: string,
): SessionCookie | null {
  const ref = projectUrl.match(/https:\/\/([a-z0-9]+)\.supabase\./)?.[1]
  if (!ref) return null

  const prefix = `sb-${ref}-auth-token`
  const parts = request.cookies
    .getAll()
    .filter((c) => c.name === prefix || c.name.startsWith(`${prefix}.`))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (parts.length === 0) return null

  try {
    let raw = parts.map((c) => c.value).join('')
    if (raw.startsWith('base64-')) raw = decodeB64(raw.slice(7))

    const accessToken = JSON.parse(raw)?.access_token
    if (typeof accessToken !== 'string') return null

    const exp = JSON.parse(decodeB64(accessToken.split('.')[1]))?.exp
    if (typeof exp !== 'number') return null

    return { accessToken, expireLe: exp }
  } catch {
    // Cookie illisible : on ne devine pas, on renvoie se faire renouveler.
    return null
  }
}

/** Décode du base64 (standard ou URL) en texte, accents compris. */
function decodeB64(v: string): string {
  const binary = atob(v.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
