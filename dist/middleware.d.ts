import { NextResponse, type NextRequest } from 'next/server';
export interface AtcMiddlewareOptions {
    /** Chemins laissés ouverts (santé, webhooks signés, assets publics). */
    publicPaths?: string[];
}
/**
 * Le matcher à monter dans chaque application. À utiliser tel quel.
 *
 * L'entrée `'/'` explicite est indispensable : sous un `basePath`, la racine de
 * l'application n'était pas capturée par le motif d'exclusion, et la page
 * d'accueil se servait donc sans session. Constaté en production sur MC CRM,
 * dont le tableau de bord répondait 200 à un inconnu.
 */
export declare const ATC_MATCHER: string[];
export declare function atcMiddleware(appSlug: string, options?: AtcMiddlewareOptions): (request: NextRequest) => Promise<NextResponse>;
