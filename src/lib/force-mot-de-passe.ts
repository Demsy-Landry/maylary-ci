/**
 * La règle de mot de passe à l'inscription.
 *
 * Elle est appliquée ici, dans le navigateur, parce que le réglage serveur qui
 * ferait foi — le refus des mots de passe connus des fuites, via
 * HaveIBeenPwned — n'est pas offert sur le palier gratuit de Supabase. Tant que
 * le projet n'est pas passé en Pro, c'est la seule barrière que nous ayons, et
 * elle vaut mieux que huit caractères sans contrainte.
 *
 * Ce qu'elle ne remplace pas : un mot de passe long et conforme peut très bien
 * figurer dans une fuite. Le jour du passage en Pro, activer le refus des mots
 * de passe compromis reste la mesure la plus utile.
 *
 * Elle ne s'applique qu'aux nouveaux mots de passe. Les comptes existants
 * continuent de se connecter avec le leur — leur imposer un changement le jour
 * d'une démonstration serait le pire moment.
 */

export const LONGUEUR_MINIMALE = 10;

export function verifierMotDePasse(motDePasse: string): string | null {
  if (motDePasse.length < LONGUEUR_MINIMALE) {
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.`;
  }
  if (!/[a-zA-Z]/.test(motDePasse) || !/[0-9]/.test(motDePasse)) {
    return 'Le mot de passe doit mêler des lettres et des chiffres.';
  }
  // Les suites les plus essayées par les attaques automatiques. La liste est
  // courte à dessein : elle arrête le pire sans transformer l'inscription en
  // parcours du combattant.
  const banals = ['motdepasse', 'password', 'azerty', 'qwerty', '123456', 'abidjan', 'maylary'];
  const enMinuscules = motDePasse.toLowerCase();
  if (banals.some((b) => enMinuscules.includes(b))) {
    return 'Ce mot de passe est trop courant. Choisissez-en un qui ne contienne pas de mot évident.';
  }
  return null;
}
