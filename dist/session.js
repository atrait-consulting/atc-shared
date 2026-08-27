/** Marge avant expiration en deçà de laquelle on part se faire renouveler. */
export const MARGE_EXPIRATION_S = 60;
export function readSessionCookie(request, projectUrl) {
    const ref = projectUrl.match(/https:\/\/([a-z0-9]+)\.supabase\./)?.[1];
    if (!ref)
        return null;
    const prefix = `sb-${ref}-auth-token`;
    const parts = request.cookies
        .getAll()
        .filter((c) => c.name === prefix || c.name.startsWith(`${prefix}.`))
        .sort((a, b) => a.name.localeCompare(b.name));
    if (parts.length === 0)
        return null;
    try {
        let raw = parts.map((c) => c.value).join('');
        if (raw.startsWith('base64-'))
            raw = decodeB64(raw.slice(7));
        const accessToken = JSON.parse(raw)?.access_token;
        if (typeof accessToken !== 'string')
            return null;
        const exp = JSON.parse(decodeB64(accessToken.split('.')[1]))?.exp;
        if (typeof exp !== 'number')
            return null;
        return { accessToken, expireLe: exp };
    }
    catch {
        // Cookie illisible : on ne devine pas, on renvoie se faire renouveler.
        return null;
    }
}
/** Décode du base64 (standard ou URL) en texte, accents compris. */
function decodeB64(v) {
    const binary = atob(v.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
