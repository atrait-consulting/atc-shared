import { after } from 'next/server';
const API = 'https://slack.com/api';
/**
 * Le jeton, débarrassé de ce qui l'entoure.
 *
 * Un copier-coller emporte presque toujours un retour à la ligne — Vercel l'a
 * signalé à la pose. Un `\n` dans un en-tête HTTP ne produit pas une erreur
 * d'authentification : il fait LEVER la requête, avec un message qui ne parle
 * pas de Slack. Autant le retirer ici, une fois, plutôt que de compter sur un
 * collage propre à chaque rotation du jeton.
 */
export function jetonPropre() {
    const brut = process.env.SLACK_BOT_TOKEN;
    if (!brut)
        return { probleme: "SLACK_BOT_TOKEN n'est pas lisible depuis ce déploiement. Une variable posée après la dernière mise en ligne n'y figure pas : il faut redéployer." };
    const net = brut.trim();
    if (net.length === 0)
        return { probleme: 'SLACK_BOT_TOKEN est vide.' };
    /* Un en-tête HTTP ne transporte que des octets. Un caractère au-delà de 255
       — le tiret cadratin d'un texte collé par mégarde, par exemple — fait LEVER
       la requête sur « Cannot convert argument to a ByteString », un message qui
       ne parle ni de Slack ni du jeton. C'est arrivé le 13/10 : la valeur posée
       était une centaine de caractères de prose, pas un jeton. On le dit donc
       ici, en clair, plutôt que de laisser déchiffrer. */
    const horsOctet = [...net].findIndex((c) => c.codePointAt(0) > 255);
    if (horsOctet >= 0) {
        return { probleme: `Caractère non ASCII à la position ${horsOctet + 1} (« ${net[horsOctet]} ») : ce n'est pas un jeton mais du texte collé par mégarde. Longueur : ${net.length}.` };
    }
    /* Un saut de ligne AU MILIEU survit au `trim` et a un code de 10, donc sous
       255 : le contrôle précédent ne le voit pas. Il casse pourtant l'en-tête
       aussi sûrement. On le nomme séparément — c'est la trace d'un copier-coller
       qui a emporté plusieurs lignes. */
    const controle = [...net].findIndex((c) => c.codePointAt(0) < 32);
    if (controle >= 0) {
        const quoi = net.charCodeAt(controle) === 10 ? 'un saut de ligne'
            : net.charCodeAt(controle) === 13 ? 'un retour chariot'
                : net.charCodeAt(controle) === 9 ? 'une tabulation'
                    : `un caractère de contrôle (code ${net.charCodeAt(controle)})`;
        return { probleme: `La valeur contient ${quoi} à la position ${controle + 1} sur ${net.length} : plusieurs lignes ont été collées. Copiez le seul jeton, depuis « OAuth & Permissions ».` };
    }
    if (net.includes(' ')) {
        return { probleme: `La valeur contient une espace à la position ${net.indexOf(' ') + 1} sur ${net.length} : ce n'est pas un jeton seul.` };
    }
    if (!net.startsWith('xoxb-')) {
        return { probleme: `La valeur ne commence pas par « xoxb- » (${net.length} caractères, commence par « ${net.slice(0, 5)} ») : ce n'est pas un jeton de robot. Celui d'un utilisateur commence par « xoxp- » et ne convient pas.` };
    }
    if (net.length < 40) {
        return { probleme: `Le jeton ne fait que ${net.length} caractères : il est tronqué. Un jeton de robot en fait une soixantaine.` };
    }
    return { jeton: net };
}
async function slack(methode, corps, jeton) {
    const r = await fetch(`${API}/${methode}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${jeton}`,
        },
        body: JSON.stringify(corps),
        cache: 'no-store',
    });
    return (await r.json());
}
/** Mémoire du processus : une adresse ne change pas d'identifiant Slack. */
const connus = new Map();
async function identifiant(email, jeton) {
    const vu = connus.get(email.toLowerCase());
    if (vu)
        return vu;
    const r = await slack(`users.lookupByEmail?email=${encodeURIComponent(email)}`, {}, jeton);
    if (!r.ok || !r.user?.id)
        return null;
    connus.set(email.toLowerCase(), r.user.id);
    return r.user.id;
}
/**
 * Vide la file des messages en attente.
 *
 * Appelée après chaque action qui crée des notifications, sans être attendue :
 * l'utilisateur n'a pas à patienter pendant que Slack répond.
 */
export async function envoyerEnAttente(supabase) {
    const j = jetonPropre();
    if ('probleme' in j) {
        console.warn(`[my.ATC] Slack indisponible : ${j.probleme}`);
        return { envoyes: 0, raison: j.probleme };
    }
    const jeton = j.jeton;
    try {
        const { data, error } = await supabase.rpc('notif_file', { p_limite: 25 });
        if (error || !Array.isArray(data) || data.length === 0) {
            return { envoyes: 0, raison: error?.message };
        }
        const partis = [];
        for (const n of data) {
            if (!n.corps)
                continue;
            /* Un échec se CONSIGNE. Sans cela, une adresse que Slack ignore fait
               repartir le même message à chaque action, indéfiniment, et personne
               ne le sait : seule une ligne de journal passagère en gardait trace. */
            const id = await identifiant(n.email, jeton);
            if (!id) {
                await supabase.rpc('notif_echoue', {
                    p_id: n.id, p_erreur: `Aucun compte Slack ne porte ${n.email} dans cet espace.`,
                });
                continue;
            }
            /* Le nom de l'application en tête : la file est commune, et « une
               demande attend votre décision » ne dit pas de quelle application
               elle vient dès qu'il y en a deux. */
            const r = await slack('chat.postMessage', {
                channel: id,
                text: `*${n.app}*\n${n.corps}`,
                unfurl_links: false, unfurl_media: false,
            }, jeton);
            if (r.ok)
                partis.push(n.id);
            else
                await supabase.rpc('notif_echoue', { p_id: n.id, p_erreur: `Slack a refusé : ${r.error}` });
        }
        if (partis.length > 0)
            await supabase.rpc('notif_envoye', { p_ids: partis });
        return { envoyes: partis.length };
    }
    catch (e) {
        console.error(`[my.ATC] envoi Slack impossible : ${e instanceof Error ? e.message : String(e)}`);
        return { envoyes: 0, raison: 'exception' };
    }
}
/**
 * À appeler après une action. Ne lève jamais, et ne se fait jamais attendre :
 * une panne de Slack ne doit pas empêcher de poser ou de valider un congé.
 */
export function notifier(supabase) {
    /* `after` tient la fonction serverless en vie le temps de l'envoi, APRÈS que
       la réponse soit partie. Un `void promesse()` dépend du bon vouloir de
       l'hébergeur : il a marché ici, mais rien ne le garantissait, et une
       notification perdue ne se voit pas. */
    try {
        after(() => envoyerEnAttente(supabase).catch(() => { }));
    }
    catch {
        void envoyerEnAttente(supabase).catch(() => { });
    }
}
/**
 * Un essai, pour savoir si la chaîne tient de bout en bout.
 *
 * Elle a quatre maillons — le jeton, l'authentification, la résolution de
 * l'adresse, l'envoi — et un échec à n'importe lequel donne la même liste vide
 * si on ne les sépare pas. Cette fonction les éprouve dans l'ordre et dit
 * LEQUEL a cédé.
 */
export async function essaiSlack(email) {
    const j = jetonPropre();
    if ('probleme' in j)
        return { ok: false, etape: 'jeton', detail: j.probleme };
    const jeton = j.jeton;
    try {
        const auth = await slack('auth.test', {}, jeton);
        if (!auth.ok) {
            return { ok: false, etape: 'authentification', detail: `Slack refuse le jeton : ${auth.error}.` };
        }
        const id = await identifiant(email, jeton);
        if (!id) {
            return { ok: false, etape: 'adresse', detail: `Aucun compte Slack ne porte ${email} dans cet espace — ou la portée users:read.email manque.` };
        }
        const r = await slack('chat.postMessage', {
            channel: id,
            text: ":satellite: *my.ATC est relié à Slack.* Ce message est un essai — les notifications de la plateforme arriveront ici.",
            unfurl_links: false,
        }, jeton);
        if (!r.ok) {
            return { ok: false, etape: 'envoi', detail: `Slack a refusé l'envoi : ${r.error}.` };
        }
        return { ok: true, etape: 'envoi', detail: `Message envoyé sur l'espace « ${auth.team ?? '?'} ». Regardez vos messages privés.` };
    }
    catch (e) {
        return { ok: false, etape: 'réseau', detail: e instanceof Error ? e.message : String(e) };
    }
}
