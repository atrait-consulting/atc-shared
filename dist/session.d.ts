import type { NextRequest } from 'next/server';
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
    accessToken: string;
    /** Instant d'expiration du jeton, en secondes epoch. */
    expireLe: number;
}
/** Marge avant expiration en deçà de laquelle on part se faire renouveler. */
export declare const MARGE_EXPIRATION_S = 60;
export declare function readSessionCookie(request: NextRequest, projectUrl: string): SessionCookie | null;
