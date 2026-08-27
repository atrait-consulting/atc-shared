/**
 * Le middleware que chaque application MC monte tel quel.
 *
 *   import { atcMiddleware } from '@atc/auth/middleware'
 *   export default atcMiddleware('sonar')
 *   export const config = {
 *     matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).*)'],
 *   }
 *
 * Le matcher DOIT être recopié en littéral : Next l'analyse à la compilation
 * et refuse un identifiant importé. L'entrée '/' est indispensable — sans
 * elle, la racine d'une application montée sous `basePath` se sert sans
 * session, ce qui est passé inaperçu jusqu'en production sur MC CRM.
 *
 * Il ne fait AUCUN appel réseau. Il lit le cookie de session, y lit le claim
 * `mc`, et tranche. Trois issues :
 *   • session valable et droit sur cette application → on passe ;
 *   • pas de session → portail, écran de connexion ;
 *   • session expirée → portail, renouvellement, puis retour ici.
 *
 * Pourquoi aucun appel : depuis l'Edge Runtime, où s'exécute le middleware,
 * un appel qui atteint le service d'authentification Supabase reste sans
 * réponse — mesuré 4 fois sur 4 depuis lhr1, quand le même appel répond en
 * 110 ms depuis un runtime Node. Le middleware attendait donc jusqu'à ce que
 * Vercel le tue : c'est l'origine des 504 rencontrés en production.
 *
 * Ce que cela change pour la sécurité : rien. Le middleware aiguille, il
 * n'autorise pas. L'identité est revalidée par `getAtcUser()` sur chaque page,
 * et toute écriture repasse par `hasAppAccess` puis par la RLS avec le vrai
 * jeton — c'est ce second niveau, et lui seul, qui rend une révocation
 * immédiate. Un cookie forgé n'obtient qu'une page qui échoue.
 *
 * Les redirections sont RELATIVES : sur une origine unique, elles restent
 * naturellement sur l'hôte courant, en production comme sur localhost. Il n'y
 * a plus une seule URL de portail à configurer.
 */
import { NextResponse, type NextRequest } from 'next/server';
export interface AtcMiddlewareOptions {
    /** Chemins laissés ouverts (santé, webhooks signés, assets publics). */
    publicPaths?: string[];
}
export declare function atcMiddleware(appSlug: string, options?: AtcMiddlewareOptions): (request: NextRequest) => NextResponse;
