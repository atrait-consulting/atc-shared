/** URL du projet Supabase `atc-platform`. */
export declare const idUrl: () => string;
/** Clé anonyme du projet `atc-platform`. Publique par nature, jamais la service_role. */
export declare const idAnonKey: () => string;
/**
 * Chemins du portail. Relatifs, et c'est tout l'intérêt : une redirection
 * relative reste sur l'origine courante, qu'on soit en production, sur une
 * prévisualisation ou sur localhost. Plus aucune URL à configurer.
 */
export declare const HUB: {
    readonly accueil: "/";
    readonly portail: "/portail";
    readonly login: "/login";
    readonly refus: "/acces";
    readonly signOut: "/auth/signout";
};
/** Nom lisible d'une application, pour les messages destinés à l'utilisateur. */
export declare const appLabel: (slug: string) => string;
