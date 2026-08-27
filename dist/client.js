/**
 * Client Supabase côté navigateur.
 *
 * Aucune option de cookie : sur une origine unique, le comportement par défaut
 * — host-only, path `/` — est exactement ce qu'il faut.
 */
import { createBrowserClient } from '@supabase/ssr';
import { idAnonKey, idUrl } from './config.js';
export function createAtcBrowserClient() {
    return createBrowserClient(idUrl(), idAnonKey());
}
