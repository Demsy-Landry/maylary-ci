import { useState } from 'react';
import { PlayCircle } from 'lucide-react';

/**
 * La vidéo du produit, quand le fournisseur en a une.
 *
 * POURQUOI ELLE NE SE LANCE PAS TOUTE SEULE
 *
 * Les grandes places de marché mettent une vidéo sur la fiche, et le fondateur
 * a demandé la même chose. Mais elles la lancent en général automatiquement, et
 * ce qui passe sur une fibre à Paris ne passe pas ici : une vidéo produit pèse
 * plusieurs mégaoctets, et sur un forfait mobile ivoirien ce sont les données
 * du client qui partent, sans qu'il ait rien demandé.
 *
 * On affiche donc l'affiche fixe — la première photo, déjà chargée — avec un
 * bouton de lecture. La vidéo n'est demandée au réseau QUE si le client clique.
 * `preload="none"` le garantit même après le clic sur l'élément.
 *
 * SI ELLE NE CHARGE PAS, ELLE DISPARAÎT
 *
 * Une adresse de vidéo morte laisserait un rectangle noir au milieu de la
 * fiche, et un rectangle noir se lit comme une page cassée. En cas d'erreur on
 * retire le bloc : la fiche reste entière, simplement sans vidéo.
 */

export default function VideoProduit({
  url,
  affiche,
}: {
  url?: string | null;
  /** Première photo du produit, utilisée comme image d'attente. */
  affiche?: string | null;
}) {
  const [lance, setLance] = useState(false);
  const [cassee, setCassee] = useState(false);

  if (!url || cassee) return null;

  return (
    <div className="mt-6">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        En vidéo
      </p>

      {lance ? (
        <video
          src={url}
          poster={affiche ?? undefined}
          controls
          autoPlay
          playsInline
          preload="none"
          onError={() => setCassee(true)}
          className="mt-2 aspect-video w-full rounded-md border bg-black"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLance(true)}
          aria-label="Lancer la vidéo du produit"
          className="group relative mt-2 block aspect-video w-full overflow-hidden rounded-md border bg-muted"
        >
          {affiche && (
            <img
              src={affiche}
              alt=""
              className="h-full w-full bg-white object-contain p-2"
              onError={() => setCassee(true)}
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
            <PlayCircle className="h-14 w-14 text-white drop-shadow" aria-hidden="true" />
          </span>
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
            Toucher pour lancer — la vidéo n’est chargée qu’à ce moment
          </span>
        </button>
      )}
    </div>
  );
}
