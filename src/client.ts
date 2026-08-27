/**
 * Client Supabase côté navigateur.
 *
 * Utilisable dans un composant `"use client"`. N'importe jamais `next/headers`.
 */
import { createBrowserClient } from '@supabase/ssr'
import { cookieDomainFor, idAnonKey, idUrl } from './config.js'

export function createAtcBrowserClient() {
  const host = typeof window === 'undefined' ? undefined : window.location.host
  const secure = typeof window === 'undefined' || window.location.protocol === 'https:'

  return createBrowserClient(idUrl(), idAnonKey(), {
    cookieOptions: {
      domain: cookieDomainFor(host),
      path: '/',
      sameSite: 'lax',
      secure,
    },
  })
}
