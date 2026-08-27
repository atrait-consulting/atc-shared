/**
 * Configuration partagée des applications MC.
 *
 * Toutes les applications lisent les mêmes variables : c'est ce qui garantit
 * qu'elles parlent au même annuaire et posent leur cookie sur le même domaine.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Voir le contrat d'intégration MC (README de atc-shared).`,
    )
  }
  return value
}

/** URL du projet Supabase `atc-platform`. */
export const idUrl = (): string => required('NEXT_PUBLIC_ATC_ID_URL')

/** Clé anonyme du projet `atc-platform`. Publique par nature, jamais la service_role. */
export const idAnonKey = (): string => required('NEXT_PUBLIC_ATC_ID_ANON_KEY')

/** Le portail, vers lequel on renvoie pour se connecter ou en cas de refus. */
export const hubUrl = (): string =>
  process.env.NEXT_PUBLIC_MC_HUB_URL ?? 'https://mc.atrait-consulting.com'

/**
 * Domaine du cookie de session, résolu pour l'hôte courant.
 *
 * Le cookie n'est partagé que si l'hôte appartient réellement au domaine
 * configuré. Sur `localhost` et sur les URLs de prévisualisation `*.vercel.app`
 * on renvoie `undefined` : le navigateur refuserait un cookie posé sur un
 * domaine suffixe public, et la session resterait invisible — un symptôme
 * qui ressemble à s'y méprendre à un bug d'authentification.
 */
export function cookieDomainFor(host?: string | null): string | undefined {
  const configured = process.env.NEXT_PUBLIC_ATC_COOKIE_DOMAIN
  if (!configured) return undefined
  if (!host) return configured

  const hostname = host.split(':')[0]!.toLowerCase()
  const base = configured.replace(/^\./, '').toLowerCase()

  return hostname === base || hostname.endsWith(`.${base}`) ? configured : undefined
}

/** Nom lisible d'une application, pour les messages destinés à l'utilisateur. */
export const appLabel = (slug: string): string => `MC ${slug.toUpperCase()}`
