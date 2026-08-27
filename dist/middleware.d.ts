import { NextResponse, type NextRequest } from 'next/server';
export interface AtcMiddlewareOptions {
    /** Chemins laissés ouverts (santé, webhooks signés, assets publics). */
    publicPaths?: string[];
}
export declare function atcMiddleware(appSlug: string, options?: AtcMiddlewareOptions): (request: NextRequest) => Promise<NextResponse>;
