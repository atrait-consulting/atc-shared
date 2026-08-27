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
export type McRole = 'owner' | 'admin' | 'editor' | 'viewer';
export interface McClaims {
    grants: Record<string, McRole>;
    active: boolean;
    owner: boolean;
    /** Faux si le hook JWT n'est pas encore activé côté Supabase. */
    present: boolean;
}
export declare function readMcClaims(accessToken: string | null | undefined): McClaims;
