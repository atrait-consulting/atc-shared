import { after } from 'next/server'

/**
 * `@atc/auth/notifier` — l'expéditeur Slack de la plateforme.
 *
 * UN SEUL ROBOT, UNE SEULE COPIE DE CE CODE
 *   Le robot s'appelle `my.ATC` et parle au nom de la plateforme, pas d'une
 *   de ses applications. Un robot par application, ce serait huit jetons à
 *   poser, huit identités dans l'espace Slack, et huit copies de ce fichier
 *   qui divergeraient. C'est le raisonnement du §7 du contrat sur le
 *   catalogue, appliqué aux notifications.
 *
 *   Ce module vit donc dans le paquet partagé, et non dans my.Admin où il est
 *   né. Une application qui veut notifier pose un message en base par
 *   `notif.poser(...)` et appelle `notifier(client)` : elle n'écrit pas une
 *   ligne de code d'envoi.
 *
 * POURQUOI SLACK PLUTÔT QUE LE COURRIEL
 *   La plateforme ne sait pas expédier de courriel — pas de SMTP, pas de
 *   fonction Edge, et les portées Microsoft accordées n'incluent pas
 *   `Mail.Send`. Slack, lui, est déjà en place, et les comptes de l'espace
 *   ATRAIT portent exactement les mêmes adresses que la plateforme : la
 *   correspondance se fait par `users.lookupByEmail`, sans table à tenir.
 *
 * CE QUI PART, ET CE QUI NE PART PAS
 *   Un message s'adresse à UNE PERSONNE ou à UN CANAL, jamais aux deux : la
 *   contrainte est dans le schéma (0154). Une personne se résout par son
 *   adresse ; un canal s'adresse par son nom.
 *
 *   Le texte est écrit EN BASE par l'application qui pose le message — elle
 *   seule sait ce qu'elle peut dire. Celui des congés (`rh.message_slack`) ne
 *   contient ni type d'absence, ni motif, ni commentaire : seulement qui,
 *   quand, ce qu'on attend, et un lien. Slack est un tiers ; un « Maladie »
 *   qui y passerait serait une donnée de santé sortie du système.
 *
 * L'ÉCHEC SE CONSIGNE, ET NE COÛTE RIEN À L'ACTION
 *   Un envoi raté incrémente `tentatives` et garde la raison. Au bout de
 *   cinq, le message sort de la file et s'affiche à l'écran — avant, un échec
 *   répété repartait indéfiniment sans que personne ne le sache. Et il ne
 *   fait JAMAIS échouer l'action qui l'a déclenché : on ne refuse pas un
 *   congé parce que Slack est en panne.
 *
 * CE QUE CE MODULE NE FAIT PAS
 *   Il ne crée pas son client Supabase. L'application lui passe le sien —
 *   celui de la session en cours, ou un client privilégié le jour où la file
 *   se videra par une tâche planifiée. Deux raisons : le paquet partagé n'a
 *   pas à choisir l'identité sous laquelle on expédie, et un `import` de
 *   `next/headers` ici rendrait le module inutilisable hors d'une requête.
 */

/** Le strict nécessaire : ce que le module appelle sur le client Supabase. */
export type ClientNotif = {
  rpc: (nom: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

const API = 'https://slack.com/api'

/**
 * Le jeton, débarrassé de ce qui l'entoure.
 *
 * Un copier-coller emporte presque toujours un retour à la ligne — Vercel l'a
 * signalé à la pose. Un `\n` dans un en-tête HTTP ne produit pas une erreur
 * d'authentification : il fait LEVER la requête, avec un message qui ne parle
 * pas de Slack. Autant le retirer ici, une fois, plutôt que de compter sur un
 * collage propre à chaque rotation du jeton.
 */
export function jetonPropre(): { jeton: string } | { probleme: string } {
  const brut = process.env.SLACK_BOT_TOKEN
  if (!brut) return { probleme: "SLACK_BOT_TOKEN n'est pas lisible depuis ce déploiement. Une variable posée après la dernière mise en ligne n'y figure pas : il faut redéployer." }

  const net = brut.trim()
  if (net.length === 0) return { probleme: 'SLACK_BOT_TOKEN est vide.' }

  /* Un en-tête HTTP ne transporte que des octets. Un caractère au-delà de 255
     — le tiret cadratin d'un texte collé par mégarde, par exemple — fait LEVER
     la requête sur « Cannot convert argument to a ByteString », un message qui
     ne parle ni de Slack ni du jeton. C'est arrivé le 13/10 : la valeur posée
     était une centaine de caractères de prose, pas un jeton. On le dit donc
     ici, en clair, plutôt que de laisser déchiffrer. */
  const horsOctet = [...net].findIndex((c) => c.codePointAt(0)! > 255)
  if (horsOctet >= 0) {
    return { probleme: `Caractère non ASCII à la position ${horsOctet + 1} (« ${net[horsOctet]} ») : ce n'est pas un jeton mais du texte collé par mégarde. Longueur : ${net.length}.` }
  }

  /* Un saut de ligne AU MILIEU survit au `trim` et a un code de 10, donc sous
     255 : le contrôle précédent ne le voit pas. Il casse pourtant l'en-tête
     aussi sûrement. On le nomme séparément — c'est la trace d'un copier-coller
     qui a emporté plusieurs lignes. */
  const controle = [...net].findIndex((c) => c.codePointAt(0)! < 32)
  if (controle >= 0) {
    const quoi = net.charCodeAt(controle) === 10 ? 'un saut de ligne'
               : net.charCodeAt(controle) === 13 ? 'un retour chariot'
               : net.charCodeAt(controle) === 9 ? 'une tabulation'
               : `un caractère de contrôle (code ${net.charCodeAt(controle)})`
    return { probleme: `La valeur contient ${quoi} à la position ${controle + 1} sur ${net.length} : plusieurs lignes ont été collées. Copiez le seul jeton, depuis « OAuth & Permissions ».` }
  }
  if (net.includes(' ')) {
    return { probleme: `La valeur contient une espace à la position ${net.indexOf(' ') + 1} sur ${net.length} : ce n'est pas un jeton seul.` }
  }
  if (!net.startsWith('xoxb-')) {
    return { probleme: `La valeur ne commence pas par « xoxb- » (${net.length} caractères, commence par « ${net.slice(0, 5)} ») : ce n'est pas un jeton de robot. Celui d'un utilisateur commence par « xoxp- » et ne convient pas.` }
  }
  if (net.length < 40) {
    return { probleme: `Le jeton ne fait que ${net.length} caractères : il est tronqué. Un jeton de robot en fait une soixantaine.` }
  }
  return { jeton: net }
}

async function slack(methode: string, corps: unknown, jeton: string) {
  const r = await fetch(`${API}/${methode}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${jeton}`,
    },
    body: JSON.stringify(corps),
    cache: 'no-store',
  })
  return (await r.json()) as { ok: boolean; error?: string; user?: { id: string } }
}

/** Mémoire du processus : une adresse ne change pas d'identifiant Slack. */
const connus = new Map<string, string>()

async function identifiant(email: string, jeton: string): Promise<string | null> {
  const vu = connus.get(email.toLowerCase())
  if (vu) return vu
  const r = await slack(`users.lookupByEmail?email=${encodeURIComponent(email)}`, {}, jeton)
  if (!r.ok || !r.user?.id) return null
  connus.set(email.toLowerCase(), r.user.id)
  return r.user.id
}

/**
 * Vide la file des messages en attente.
 *
 * Appelée après chaque action qui crée des notifications, sans être attendue :
 * l'utilisateur n'a pas à patienter pendant que Slack répond.
 */
export async function envoyerEnAttente(supabase: ClientNotif): Promise<{ envoyes: number; raison?: string }> {
  const j = jetonPropre()
  if ('probleme' in j) {
    console.warn(`[my.ATC] Slack indisponible : ${j.probleme}`)
    return { envoyes: 0, raison: j.probleme }
  }
  const jeton = j.jeton

  try {
    const { data, error } = await supabase.rpc('notif_file', { p_limite: 25 })
    if (error || !Array.isArray(data) || data.length === 0) {
      return { envoyes: 0, raison: error?.message }
    }

    const partis: string[] = []
    for (const n of data as Array<{ id: string; app: string; email: string | null; canal: string | null; corps: string }>) {
      if (!n.corps) continue

      /* Deux destinations possibles depuis 0154, et une seule à la fois —
         le schéma l'impose. Un canal s'adresse directement par son nom ;
         une personne demande d'abord une résolution d'adresse. */
      let id: string | null
      if (n.canal) {
        id = n.canal
      } else {
        /* Un échec se CONSIGNE. Sans cela, une adresse que Slack ignore fait
           repartir le même message à chaque action, indéfiniment, et personne
           ne le sait : seule une ligne de journal passagère en gardait trace. */
        id = await identifiant(n.email ?? '', jeton)
        if (!id) {
          await supabase.rpc('notif_echoue', {
            p_id: n.id, p_erreur: `Aucun compte Slack ne porte ${n.email} dans cet espace.`,
          })
          continue
        }
      }

      /* Le nom de l'application en tête : la file est commune, et « une
         demande attend votre décision » ne dit pas de quelle application
         elle vient dès qu'il y en a deux. */
      const r = await slack('chat.postMessage', {
        channel: id,
        text: `*${n.app}*\n${n.corps}`,
        unfurl_links: false, unfurl_media: false,
      }, jeton)

      if (r.ok) partis.push(n.id)
      else {
        /* `not_in_channel` est l'échec le plus probable sur un canal, et le
           plus déroutant : le jeton est bon, le canal existe, et Slack
           refuse. On dit quoi faire, sinon on cherche du côté du jeton. */
        const quoi = r.error === 'not_in_channel'
          ? `Le robot n'est pas dans #${n.canal} : invitez-le (/invite @my.ATC) ou ajoutez la portée chat:write.public.`
          : r.error === 'channel_not_found'
            ? `Slack ne connaît pas #${n.canal} — nom mal orthographié, ou canal privé où le robot n'est pas.`
            : `Slack a refusé : ${r.error}`
        await supabase.rpc('notif_echoue', { p_id: n.id, p_erreur: quoi })
      }
    }

    if (partis.length > 0) await supabase.rpc('notif_envoye', { p_ids: partis })
    return { envoyes: partis.length }
  } catch (e) {
    console.error(`[my.ATC] envoi Slack impossible : ${e instanceof Error ? e.message : String(e)}`)
    return { envoyes: 0, raison: 'exception' }
  }
}

/**
 * À appeler après une action. Ne lève jamais, et ne se fait jamais attendre :
 * une panne de Slack ne doit pas empêcher de poser ou de valider un congé.
 */
export function notifier(supabase: ClientNotif): void {
  /* `after` tient la fonction serverless en vie le temps de l'envoi, APRÈS que
     la réponse soit partie. Un `void promesse()` dépend du bon vouloir de
     l'hébergeur : il a marché ici, mais rien ne le garantissait, et une
     notification perdue ne se voit pas. */
  try {
    after(() => envoyerEnAttente(supabase).catch(() => {}))
  } catch {
    void envoyerEnAttente(supabase).catch(() => {})
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
export async function essaiSlack(email: string): Promise<{ ok: boolean; etape: string; detail: string }> {
  const j = jetonPropre()
  if ('probleme' in j) return { ok: false, etape: 'jeton', detail: j.probleme }
  const jeton = j.jeton

  try {
    const auth = await slack('auth.test', {}, jeton) as unknown as
      { ok: boolean; error?: string; team?: string; user?: string }
    if (!auth.ok) {
      return { ok: false, etape: 'authentification', detail: `Slack refuse le jeton : ${auth.error}.` }
    }

    const id = await identifiant(email, jeton)
    if (!id) {
      return { ok: false, etape: 'adresse', detail: `Aucun compte Slack ne porte ${email} dans cet espace — ou la portée users:read.email manque.` }
    }

    const r = await slack('chat.postMessage', {
      channel: id,
      text: ":satellite: *my.ATC est relié à Slack.* Ce message est un essai — les notifications de la plateforme arriveront ici.",
      unfurl_links: false,
    }, jeton)
    if (!r.ok) {
      return { ok: false, etape: 'envoi', detail: `Slack a refusé l'envoi : ${r.error}.` }
    }
    return { ok: true, etape: 'envoi', detail: `Message envoyé sur l'espace « ${auth.team ?? '?'} ». Regardez vos messages privés.` }
  } catch (e) {
    return { ok: false, etape: 'réseau', detail: e instanceof Error ? e.message : String(e) }
  }
}
