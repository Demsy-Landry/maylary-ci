import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * Un emplacement publicitaire.
 *
 * Trois décisions qui tiennent tout le composant.
 *
 * **Rien ne s'affiche quand rien n'est vendu.** Pas de cadre gris « espace
 * publicitaire disponible » : sur un site qui démarre, il annonce surtout qu'on
 * n'a pas d'annonceurs. L'absence est plus digne que le vide encadré.
 *
 * **L'annonce est signalée comme telle.** Un client qui ne distingue pas un
 * conseil d'une réclame finit par ne croire ni l'un ni l'autre — et ce qui se
 * vend ici, c'est la fiabilité d'un chiffre. La mention « Annonce » est
 * discrète mais elle n'est pas négociable.
 *
 * **L'impression ne se compte qu'une fois vue.** Compter au montage gonflerait
 * les chiffres avec des emplacements que personne n'a eus à l'écran — et un
 * annonceur qui découvre l'écart ne revient pas. On attend l'entrée réelle dans
 * le champ de vision.
 */

interface Annonce {
  id: string;
  annonceur: string;
  titre: string;
  texte: string | null;
  image_url: string | null;
  lien: string;
  origine: 'interne' | 'externe';
}

/**
 * Ce que le serveur renvoie n'est pas forcément ce qu'on attend.
 *
 * CE QUI EST ARRIVÉ, ET QUI SE SERAIT VU UN JOUR DE FORTE AFFLUENCE
 *
 * La ligne d'avant écrivait `(data as Annonce | null) ?? null`. Ce `as` est
 * une promesse faite au compilateur, pas une vérification : à l'exécution,
 * personne ne regarde ce qui arrive vraiment. Et `?? null` ne rattrape que
 * `null` ou `undefined` — un tableau vide, un objet incomplet, une réponse
 * tronquée passent tous.
 *
 * La ligne suivante faisait alors `annonce.lien.startsWith('/')` sur un
 * `lien` inexistant, et TOUTE LA PAGE tombait. Mesuré : la page « Nos
 * services » ne s'affichait plus du tout, remplacée par le filet de sécurité.
 *
 * Ce n'est pas un cas d'école. Une réponse incomplète arrive précisément
 * quand le réseau souffre — c'est-à-dire les jours de forte affluence, ceux
 * où l'on peut le moins se permettre de perdre une page.
 *
 * LA RÈGLE
 *
 * Un encart publicitaire est un ornement. S'il ne peut pas s'afficher, il
 * disparaît en silence ; il n'emporte jamais la page qui l'accueille. On
 * vérifie donc ce qu'on a reçu avant de s'en servir, et au moindre doute on
 * ne montre rien.
 */
function annonceUtilisable(data: unknown): Annonce | null {
  // La fonction serveur peut rendre l'objet seul ou dans un tableau.
  const brut = Array.isArray(data) ? data[0] : data;
  if (!brut || typeof brut !== 'object') return null;

  const a = brut as Partial<Annonce>;
  // Le lien et le titre sont les deux seuls champs dont l'affichage dépend
  // vraiment : sans eux, il n'y a rien à montrer ni où aller.
  if (typeof a.lien !== 'string' || a.lien.length === 0) return null;
  if (typeof a.titre !== 'string' || a.titre.length === 0) return null;
  if (typeof a.id !== 'string') return null;

  return a as Annonce;
}

export default function EmplacementPublicitaire({
  code,
  className = '',
}: {
  code: string;
  className?: string;
}) {
  const [annonce, setAnnonce] = useState<Annonce | null>(null);
  const cadreRef = useRef<HTMLDivElement>(null);
  const compte = useRef(false);

  useEffect(() => {
    supabase
      .rpc('app_e08c374bc4_annonce_pour', { p_emplacement: code })
      .then(({ data }) => setAnnonce(annonceUtilisable(data)));
  }, [code]);

  useEffect(() => {
    if (!annonce || !cadreRef.current || compte.current) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const el = cadreRef.current;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (!entrees.some((e) => e.isIntersecting) || compte.current) return;
        compte.current = true;
        observateur.disconnect();
        // `.then()` n'est pas décoratif : le constructeur de requête Supabase
        // est paresseux et n'envoie rien tant que personne ne l'attend. Écrit
        // avec `void`, ce comptage ne partait jamais — et les statistiques
        // seraient restées à zéro sans que rien ne le signale.
        supabase
          .rpc('app_e08c374bc4_compter_pub', { p_annonce: annonce.id, p_type: 'impression' })
          .then(() => {});
      },
      { threshold: 0.5 },
    );
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [annonce]);

  if (!annonce) return null;

  const auClic = () => {
    supabase
      .rpc('app_e08c374bc4_compter_pub', { p_annonce: annonce.id, p_type: 'clic' })
      .then(() => {});
  };

  const interne = annonce.lien.startsWith('/');

  const contenu = (
    <>
      {annonce.image_url && (
        <img
          src={annonce.image_url}
          alt=""
          className="h-24 w-full rounded object-cover sm:h-28"
          loading="lazy"
        />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{annonce.titre}</p>
        {annonce.texte && (
          <p className="mt-0.5 text-sm text-muted-foreground">{annonce.texte}</p>
        )}
        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          Annonce · {annonce.annonceur}
        </p>
      </div>
    </>
  );

  const classes =
    'block rounded-lg border border-dashed bg-muted/30 p-4 transition hover:border-primary/50 hover:bg-muted/50';

  return (
    <div ref={cadreRef} className={className}>
      {interne ? (
        <Link to={annonce.lien} onClick={auClic} className={classes}>
          {contenu}
        </Link>
      ) : (
        <a
          href={annonce.lien}
          onClick={auClic}
          target="_blank"
          // `sponsored` et `nofollow` : un lien payé qui ne se déclare pas
          // dégrade le référencement du site qui l'héberge.
          rel="sponsored nofollow noopener noreferrer"
          className={classes}
        >
          {contenu}
        </a>
      )}
    </div>
  );
}
