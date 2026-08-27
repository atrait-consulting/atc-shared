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
import { NextResponse } from 'next/server';
import { HUB, idUrl } from './config.js';
import { readMcClaims } from './jwt.js';
import { MARGE_EXPIRATION_S, readSessionCookie } from './session.js';
const alwaysPublic = ['/api/health'];
export function atcMiddleware(appSlug, options = {}) {
    const publicPaths = [...alwaysPublic, ...(options.publicPaths ?? [])];
    return function middleware(request) {
        const { pathname } = request.nextUrl;
        if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
            return NextResponse.next();
        }
        const session = readSessionCookie(request, idUrl());
        if (!session) {
            return NextResponse.redirect(new URL(retour(request, appSlug, HUB.login), request.url));
        }
        if (session.expireLe - MARGE_EXPIRATION_S <= Date.now() / 1000) {
            return NextResponse.redirect(new URL(retour(request, appSlug, HUB.rafraichir), request.url));
        }
        const claims = readMcClaims(session.accessToken);
        /* Claim absent : le hook JWT n'est pas activé côté Supabase. On ne peut
           plus le compenser par un appel en base — il n'aboutirait pas depuis
           l'Edge. On renvoie donc au portail, qui tranche en runtime Node. */
        if (!claims.present) {
            return NextResponse.redirect(new URL(retour(request, appSlug, HUB.portail), request.url));
        }
        if (!claims.active || !claims.grants[appSlug]) {
            const refus = `${HUB.refus}?app=${encodeURIComponent(appSlug)}`;
            return NextResponse.redirect(new URL(refus, request.url));
        }
        return NextResponse.next();
    };
}
/**
 * `basePath` retire le préfixe de `pathname` : une application montée sous
 * /sonar voit « /app.html ». Le portail, lui, vit à la racine de l'origine et
 * renverrait donc vers « /app.html », qui n'existe pas chez lui. On remet le
 * préfixe pour que le retour tombe au bon endroit.
 */
function retour(request, appSlug, cible) {
    const path = request.nextUrl.pathname;
    const prefixe = `/${appSlug}`;
    const complet = path === prefixe || path.startsWith(`${prefixe}/`) ? path : prefixe + path;
    const params = new URLSearchParams({
        app: appSlug,
        next: complet + request.nextUrl.search,
    });
    return `${cible}?${params.toString()}`;
}
