/**
 * Affichage des fichiers stockés dans un bucket privé.
 *
 * Les pièces déposées par les clients ne sont pas accessibles par URL publique :
 * chaque consultation demande un lien signé, valable une heure, délivré
 * seulement si l'utilisateur a le droit de lire l'objet.
 */
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ouvrirDocument, useUrlsSignees } from '@/lib/storage';

export function GaleriePhotosPrivees({
  bucket,
  valeurs,
  className = 'h-16 w-16 rounded-md border object-cover',
}: {
  bucket: string;
  valeurs: string[];
  className?: string;
}) {
  const urls = useUrlsSignees(bucket, valeurs);

  if (valeurs.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {valeurs.map((valeur, i) =>
        urls[i] ? (
          <img key={valeur} src={urls[i]!} alt="" className={className} />
        ) : (
          // Tant que la signature n'est pas revenue, on réserve la place plutôt
          // que de faire sauter la mise en page.
          <div key={valeur} className={`${className} animate-pulse bg-muted`} />
        ),
      )}
    </div>
  );
}

export function LienDocumentPrive({
  bucket,
  valeur,
  className,
  children,
}: {
  bucket: string;
  valeur: string;
  className?: string;
  children: ReactNode;
}) {
  const [ouverture, setOuverture] = useState(false);

  const consulter = async () => {
    setOuverture(true);
    const ouvert = await ouvrirDocument(bucket, valeur);
    if (!ouvert) toast.error("Ce document n'est plus accessible.");
    setOuverture(false);
  };

  return (
    <button type="button" onClick={consulter} disabled={ouverture} className={className}>
      {children}
    </button>
  );
}
