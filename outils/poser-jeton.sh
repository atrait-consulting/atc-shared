#!/usr/bin/env bash
#
# Poser un secret sur un projet Vercel, SANS le faire passer par l'œil de
# personne — et en refusant d'écrire une valeur mal formée.
#
# POURQUOI CET OUTIL EXISTE
#   Le 13/10/2026, trois tentatives de pose de `SLACK_BOT_TOKEN` ont échoué
#   l'une après l'autre : la première valeur était de la prose contenant un
#   tiret cadratin (un caractère au-delà de 255 fait LEVER `fetch` sur
#   « Cannot convert argument to a ByteString », un message qui ne parle ni de
#   Slack ni du jeton) ; la deuxième contenait un saut de ligne au milieu ; la
#   troisième a été écrite PAR Vercel malgré son propre avertissement, parce
#   que `--force` transforme le refus en simple « ! ».
#
#   Chaque échec coûtait un déploiement et un essai pour être découvert. Cet
#   outil déplace le contrôle AVANT l'écriture : si la forme est mauvaise, rien
#   n'est posé et on sait pourquoi en une seconde.
#
# CE QU'IL N'AFFICHE JAMAIS
#   Aucun caractère de la valeur. Seulement des faits dérivés : une longueur,
#   une position, un code. C'est la règle de la plateforme — un secret ne passe
#   pas par une conversation, ni par un journal.
#
# USAGE
#   1. Copier le jeton (le bouton « Copy » de la page, pas une sélection souris)
#   2. cd ~/Dev/atrait/<dépôt>
#   3. ~/Dev/atrait/atc-shared/outils/poser-jeton.sh [NOM] [--essai]
#
#   --essai  contrôle la forme et n'écrit rien.

set -euo pipefail

NOM="${1:-SLACK_BOT_TOKEN}"
ESSAI=""
for a in "$@"; do [ "$a" = "--essai" ] && ESSAI="oui"; done

if [ ! -f package.json ]; then
  echo "Il faut se placer dans le dossier du dépôt (celui qui porte package.json)." >&2
  exit 1
fi

JETON=$(pbpaste | NOM="$NOM" python3 -I -c '
import os, sys
nom = os.environ["NOM"]
net = sys.stdin.read().strip()

def refus(m):
    sys.stderr.write("  REFUS : " + m + "\n")
    sys.stderr.write("  Rien n’a été posé. Recopiez la valeur et relancez.\n")
    sys.exit(1)

if not net:
    refus("le presse-papiers est vide. Utilisez le bouton « Copy » de la page, pas une sélection à la souris.")

# Un saut de ligne AU MILIEU survit au strip et a un code de 10, donc sous 255 :
# le controle du non-ASCII ne le voit pas. Il casse pourtant len-tete aussi
# surement. On le nomme separement.
ctrl = next(((i, ord(c)) for i, c in enumerate(net) if ord(c) < 32), None)
if ctrl:
    quoi = {10: "un saut de ligne", 13: "un retour chariot", 9: "une tabulation"}.get(
        ctrl[1], "un caractère de contrôle (code %d)" % ctrl[1])
    refus("%s AU MILIEU, position %d sur %d : plusieurs lignes ont été collées."
          % (quoi, ctrl[0] + 1, len(net)))

hors = next((i for i, c in enumerate(net) if ord(c) > 126), None)
if hors is not None:
    refus("caractère non ASCII à la position %d sur %d : c’est du texte collé par mégarde, pas un jeton."
          % (hors + 1, len(net)))

if " " in net:
    refus("une espace à la position %d sur %d : ce n’est pas une valeur seule."
          % (net.index(" ") + 1, len(net)))

if nom == "SLACK_BOT_TOKEN":
    if not net.startswith("xoxb-"):
        refus("ne commence pas par « xoxb- » (%d caractères). Celui d’un utilisateur commence par « xoxp- » et ne convient pas : il faut le « Bot User OAuth Token », qui n’apparaît qu’APRÈS « Install to Workspace »."
              % len(net))
    if len(net) < 40:
        refus("%d caractères seulement : tronqué. Un jeton de robot en fait une soixantaine." % len(net))

sys.stderr.write("  Forme correcte : %d caractères, aucun caractère parasite.\n" % len(net))
sys.stdout.write(net)
')

PROJET=$(basename "$PWD")
if [ -n "$ESSAI" ]; then
  echo "  --essai : rien n'a été posé sur $PROJET."
  exit 0
fi

# `printf %s` et non `echo` : `echo` rajouterait le saut de ligne qu'on vient
# justement de retirer.
printf %s "$JETON" | npx vercel@62 env add "$NOM" production --type secret --force --yes
echo "  $NOM posé sur $PROJET. Un déploiement est nécessaire pour qu'il entre en vigueur."
