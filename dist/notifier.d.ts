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
    rpc: (nom: string, args?: Record<string, unknown>) => PromiseLike<{
        data: unknown;
        error: {
            message: string;
        } | null;
    }>;
};
/**
 * Le jeton, débarrassé de ce qui l'entoure.
 *
 * Un copier-coller emporte presque toujours un retour à la ligne — Vercel l'a
 * signalé à la pose. Un `\n` dans un en-tête HTTP ne produit pas une erreur
 * d'authentification : il fait LEVER la requête, avec un message qui ne parle
 * pas de Slack. Autant le retirer ici, une fois, plutôt que de compter sur un
 * collage propre à chaque rotation du jeton.
 */
export declare function jetonPropre(): {
    jeton: string;
} | {
    probleme: string;
};
/**
 * Vide la file des messages en attente.
 *
 * Appelée après chaque action qui crée des notifications, sans être attendue :
 * l'utilisateur n'a pas à patienter pendant que Slack répond.
 */
export declare function envoyerEnAttente(supabase: ClientNotif): Promise<{
    envoyes: number;
    raison?: string;
}>;
/**
 * À appeler après une action. Ne lève jamais, et ne se fait jamais attendre :
 * une panne de Slack ne doit pas empêcher de poser ou de valider un congé.
 */
export declare function notifier(supabase: ClientNotif): void;
/**
 * Un essai, pour savoir si la chaîne tient de bout en bout.
 *
 * Elle a quatre maillons — le jeton, l'authentification, la résolution de
 * l'adresse, l'envoi — et un échec à n'importe lequel donne la même liste vide
 * si on ne les sépare pas. Cette fonction les éprouve dans l'ordre et dit
 * LEQUEL a cédé.
 */
export declare function essaiSlack(email: string): Promise<{
    ok: boolean;
    etape: string;
    detail: string;
}>;
