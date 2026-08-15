#!/usr/bin/env bash
#
# Déployer une fonction serveur depuis le disque.
#
# POURQUOI CE SCRIPT EXISTE
#
# L'outil de déploiement intégré exige que le contenu du fichier soit recopié
# dans la commande. Pour la fonction du Déclarant, cela représente 37 000
# caractères et 920 lignes : une coquille de recopie arrête l'assistant pour
# tout le monde, et ce risque n'a aucune contrepartie.
#
# La ligne de commande officielle de Supabase, elle, envoie le fichier tel
# qu'il est sur le disque. Il lui manque une seule chose, un jeton d'accès
# personnel, à poser en variable d'environnement de l'environnement Claude Code
# sous le nom SUPABASE_ACCESS_TOKEN.
#
# ATTENTION : une variable d'environnement est injectée au DÉMARRAGE du
# conteneur. Si elle vient d'être ajoutée, elle n'atteindra la session en cours
# que lorsqu'une nouvelle session sera ouverte. C'est le piège de ce réglage, et
# c'est pourquoi le script le vérifie avant toute chose.
#
# USAGE
#   scripts/deployer-fonctions.sh app_e08c374bc4_agent
#   scripts/deployer-fonctions.sh                 # liste les fonctions
#
set -euo pipefail

PROJET="oubowmftzxpruckjzwuq"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  cat >&2 <<'FIN'
SUPABASE_ACCESS_TOKEN est absent de cet environnement.

  1. Générez un jeton sur https://supabase.com/dashboard/account/tokens
  2. Ajoutez-le aux variables d'environnement de l'environnement Claude Code
     (PAS dans les secrets des Edge Functions — c'est un autre endroit).
  3. OUVREZ UNE NOUVELLE SESSION : la variable est injectée au démarrage du
     conteneur, elle n'atteint pas une session déjà en cours.

Le jeton donne accès au compte Supabase. Il se révoque d'un clic depuis la même
page si besoin.
FIN
  exit 1
fi

if [ $# -eq 0 ]; then
  echo "Fonctions disponibles :"
  ls -1 "$RACINE/supabase/functions" | grep -v '^_' | sed 's/^/  /'
  echo
  echo "Usage : $0 <nom-de-la-fonction>"
  exit 0
fi

FONCTION="$1"
DOSSIER="$RACINE/supabase/functions/$FONCTION"

if [ ! -d "$DOSSIER" ]; then
  echo "Fonction inconnue : $FONCTION" >&2
  echo "Lancez le script sans argument pour voir la liste." >&2
  exit 1
fi

echo "Déploiement de $FONCTION ($(wc -c < "$DOSSIER/index.ts") octets)…"

# --no-verify-jwt n'est PAS passé par défaut : une fonction qui perdrait son
# contrôle d'authentification lors d'un simple redéploiement serait ouverte à
# tout le monde sans que personne ne s'en aperçoive. Les rares fonctions qui
# doivent l'être — le serveur MCP, qui porte son propre jeton — se déploient à
# la main, en le disant.
npx --yes supabase@2 functions deploy "$FONCTION" \
  --project-ref "$PROJET" \
  --workdir "$RACINE"

echo
echo "Déployée. À vérifier maintenant, pas plus tard : appelez la fonction"
echo "avec un vrai compte et confirmez qu'elle répond. Un déploiement qui"
echo "casse ne se voit que là."
