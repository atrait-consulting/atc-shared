/**
 * Configuration partagée des applications MC.
 *
 * Depuis la bascule sur une origine unique (my.atrait-consulting.com), il n'y
 * a plus de domaine de cookie à gérer : tout vit sur le même hôte, les
 * applications sous un chemin. Le cookie de session est donc host-only, ce que
 * tous les navigateurs acceptent sans réserve — y compris Safari iOS, dont
 * les restrictions avaient coûté cher sur les projets précédents.
 *
 * Ces constantes DOIVENT s'écrire en toutes lettres : Next remplace les
 * `process.env.NEXT_PUBLIC_*` à la compilation, mais uniquement quand
 * l'expression est littérale. Un `process.env[name]` dynamique fonctionne
 * côté serveur et vaut `undefined` dans le navigateur — panne déroutante,
 * parce que les pages se rendent pendant que le moindre clic ne fait rien.
 */
const ID_URL = process.env.NEXT_PUBLIC_ATC_ID_URL
const ID_ANON_KEY = process.env.NEXT_PUBLIC_ATC_ID_ANON_KEY

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Voir le contrat d'intégration MC (README de atc-shared).`,
    )
  }
  return value
}

/** URL du projet Supabase `atc-platform`. */
export const idUrl = (): string => required(ID_URL, 'NEXT_PUBLIC_ATC_ID_URL')

/** Clé anonyme du projet `atc-platform`. Publique par nature, jamais la service_role. */
export const idAnonKey = (): string => required(ID_ANON_KEY, 'NEXT_PUBLIC_ATC_ID_ANON_KEY')

/**
 * Chemins du portail. Relatifs, et c'est tout l'intérêt : une redirection
 * relative reste sur l'origine courante, qu'on soit en production, sur une
 * prévisualisation ou sur localhost. Plus aucune URL à configurer.
 */
export const HUB = {
  accueil: '/',
  portail: '/portail',
  login: '/login',
  refus: '/acces',
  signOut: '/auth/signout',
} as const

/** Nom lisible d'une application, pour les messages destinés à l'utilisateur. */
export const appLabel = (slug: string): string => `MC ${slug.toUpperCase()}`
