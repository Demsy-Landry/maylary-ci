import type { AuthError } from '@supabase/supabase-js';

/**
 * Traduire un échec de connexion sans mentir sur sa cause.
 *
 * Les deux écrans de connexion affichaient « Email ou mot de passe incorrect »
 * quelle que soit l'erreur. Une coupure réseau, une limite de débit atteinte
 * après plusieurs essais, un compte non confirmé : tout était présenté comme un
 * mot de passe faux. On cherche alors le bon mot de passe qu'on avait déjà, on
 * réessaie, on déclenche à nouveau la limite — et la connexion paraît instable
 * alors qu'elle refuse pour une raison qu'on ne nous a jamais dite.
 *
 * Ce que le message ne dira jamais : si l'adresse existe. Distinguer « compte
 * inconnu » de « mot de passe faux » offrirait à qui essaie une liste de nos
 * clients.
 */
export function messageDeConnexion(erreur: AuthError | null): string {
  if (!erreur) return '';

  const statut = erreur.status ?? 0;
  const texte = `${erreur.message ?? ''} ${erreur.code ?? ''}`.toLowerCase();

  if (statut === 429 || texte.includes('rate limit') || texte.includes('too many')) {
    return 'Trop de tentatives en peu de temps. Patientez une minute avant de réessayer — votre mot de passe n’est pas en cause.';
  }
  if (texte.includes('email not confirmed')) {
    return "Cette adresse n'a pas encore été confirmée. Vérifiez votre boîte mail.";
  }
  if (statut === 0 || texte.includes('fetch') || texte.includes('network') || texte.includes('abort')) {
    return 'Le serveur est injoignable. Vérifiez votre connexion, puis réessayez.';
  }
  if (statut >= 500) {
    return 'Le service d’authentification est momentanément indisponible. Réessayez dans un instant.';
  }
  return 'Email ou mot de passe incorrect.';
}
