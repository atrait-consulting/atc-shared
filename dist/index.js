/**
 * `@atc/auth` — socle d'authentification des applications MC.
 *
 * Points d'entrée :
 *   @atc/auth              types, configuration, charte
 *   @atc/auth/client       client Supabase navigateur
 *   @atc/auth/server       client Supabase serveur + gardes (`requireApp`)
 *   @atc/auth/middleware   `atcMiddleware('<slug>')`
 *   @atc/auth/tokens       charte graphique seule
 *
 * Ce module racine n'importe jamais `next/headers` : il reste utilisable
 * depuis un composant client.
 */
export { appLabel, HUB, idAnonKey, idUrl } from './config.js';
export { readMcClaims } from './jwt.js';
export { tokens } from './tokens.js';
