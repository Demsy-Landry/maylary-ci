/**
 * Accès aux fichiers privés du stockage.
 *
 * Les documents et photos déposés par les clients (factures fournisseurs,
 * packing lists, photos de marchandise) ne sont pas publics : leurs buckets
 * n'autorisent la lecture qu'à leur propriétaire et aux administrateurs, et
 * l'affichage passe par une URL signée à durée limitée.
 *
 * Les enregistrements créés avant ce changement stockent une URL publique
 * complète ; les nouveaux stockent le chemin de l'objet. Les deux formes sont
 * acceptées ici, ce qui évite une migration de données.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Durée de validité d'un lien signé. Assez pour consulter, trop court pour circuler. */
const DUREE_SIGNATURE_SECONDES = 3600;

/**
 * Ramène une valeur stockée au chemin de l'objet dans son bucket.
 * Accepte aussi bien `https://…/object/public/<bucket>/<chemin>` que `<chemin>`.
 */
export function cheminObjet(bucket: string, valeur: string): string {
  if (!valeur.startsWith('http')) return valeur;
  const marqueur = `/${bucket}/`;
  const position = valeur.indexOf(marqueur);
  if (position === -1) return valeur;
  return decodeURIComponent(valeur.slice(position + marqueur.length));
}

/**
 * URL signée pour consulter un objet privé. Renvoie null si l'objet est
 * introuvable ou si l'utilisateur n'y a pas droit — l'appelant affiche alors
 * un état dégradé plutôt qu'un lien mort.
 */
export async function urlSignee(bucket: string, valeur: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(cheminObjet(bucket, valeur), DUREE_SIGNATURE_SECONDES);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Signe une liste d'objets en une fois, en conservant l'ordre d'entrée.
 * Les objets inaccessibles ressortent à null.
 */
export async function urlsSignees(bucket: string, valeurs: string[]): Promise<(string | null)[]> {
  if (valeurs.length === 0) return [];
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(valeurs.map((v) => cheminObjet(bucket, v)), DUREE_SIGNATURE_SECONDES);
  if (error || !data) return valeurs.map(() => null);
  return data.map((d) => d.signedUrl ?? null);
}

/** Signe une liste d'objets et rafraîchit le composant quand c'est prêt. */
export function useUrlsSignees(bucket: string, valeurs: string[]): (string | null)[] {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  // Les tableaux sont recréés à chaque rendu : on compare leur contenu, pas leur
  // identité, sous peine de resigner en boucle.
  const cle = valeurs.join('|');

  useEffect(() => {
    let annule = false;
    if (valeurs.length === 0) {
      setUrls([]);
      return;
    }
    urlsSignees(bucket, valeurs).then((res) => {
      if (!annule) setUrls(res);
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, cle]);

  return urls;
}

/**
 * Ouvre un document privé dans un nouvel onglet.
 *
 * L'onglet est ouvert avant l'attente : un `window.open` appelé après un `await`
 * n'est plus rattaché au clic de l'utilisateur et se fait bloquer par les
 * navigateurs. On l'ouvre vide, puis on l'envoie sur le lien signé.
 */
export async function ouvrirDocument(bucket: string, valeur: string): Promise<boolean> {
  const onglet = window.open('', '_blank');
  const url = await urlSignee(bucket, valeur);
  if (!url) {
    onglet?.close();
    return false;
  }
  if (onglet) onglet.location.href = url;
  else window.location.href = url;
  return true;
}
