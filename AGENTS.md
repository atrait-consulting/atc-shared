# Conventions — plateforme MC (ATRAIT Consulting)

**Avant d'écrire du code dans ce dépôt ou dans une application MC, lire
[`CONTRAT-MC.md`](./CONTRAT-MC.md) en entier.** Il fait foi.

Les cinq points qu'on oublie le plus souvent :

1. **Aucune application ne gère l'authentification.** Le portail authentifie, les applications
   vérifient. Pas d'écran de connexion, pas de cookie maison, pas de mot de passe.
2. **Deux niveaux de contrôle.** Le middleware ne suffit pas : toute écriture rappelle
   `hasAppAccess()`, sans quoi une révocation de droit n'a aucun effet immédiat.
3. **Les rôles viennent de la plateforme**, jamais d'une table d'utilisateurs propre à
   l'application. Deux endroits pour accorder un accès finissent par diverger.
4. **Le `matcher` du middleware est un littéral et contient `'/'`.** Next refuse un identifiant
   importé, et sans `'/'` la racine d'une application sous `basePath` se sert sans session.
5. **Toute migration passe par une PR sur `atc-db`.** Jamais de DDL à la main, jamais de
   `supabase db push` depuis un dépôt applicatif.

La section « Les pièges déjà payés » du contrat recense une dizaine de pannes traversées en
production, avec leur symptôme exact. La lire fait gagner des heures — plusieurs de ces messages
d'erreur désignent le mauvais coupable.

## Ce dépôt

`@atc/auth` — socle d'authentification commun. Publié en **archive HTTPS taguée**, `dist/` versionné :
une dépendance Git serait normalisée par npm en `git+ssh://`, que les machines de build ne savent
pas cloner.

Après toute modification de `src/` : `npm run build`, committer le `dist/` régénéré, poser un
nouveau tag, puis faire monter la version dans les applications. Elles épinglent un tag, jamais
`main`.
