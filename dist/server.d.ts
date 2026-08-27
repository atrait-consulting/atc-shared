import type { McRole } from './jwt.js';
export declare function createAtcServerClient(): Promise<import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>>;
/** L'utilisateur connecté, vérifié auprès de Supabase. `null` si pas de session. */
export declare function getAtcUser(): Promise<import("@supabase/auth-js").User | null>;
/**
 * Contrôle de niveau 2 : interroge la base, pas le jeton.
 *
 * À appeler sur toute écriture et toute donnée sensible. Une révocation prend
 * alors effet immédiatement, sans attendre l'expiration du JWT.
 */
export declare function hasAppAccess(appSlug: string): Promise<boolean>;
/** Le rôle de l'utilisateur courant sur l'application, ou `null`. */
export declare function appRole(appSlug: string): Promise<McRole | null>;
/**
 * Garde de page ou de Server Action.
 * Renvoie vers le portail si la personne n'est pas connectée, vers la page de
 * refus si elle l'est mais n'a pas le droit d'entrer ici.
 */
export declare function requireApp(appSlug: string): Promise<void>;
/** URL de déconnexion : un formulaire POST, jamais un `signOut()` côté client. */
export declare const signOutUrl: () => string;
/** Mémorise l'application ouverte, pour que la racine y renvoie la prochaine fois. */
export declare function touchLastApp(appSlug: string): Promise<void>;
