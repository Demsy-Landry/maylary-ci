import { useEffect, useMemo, useState } from 'react';
import { supabase, DECLINAISONS_PUBLIC_VIEW } from '@/lib/supabase';

/**
 * Choisir la taille et la couleur d'un article.
 *
 * CE QUE ÇA RÉPARE
 *
 * Rien ne permettait de choisir. Un article n'était rattaché qu'à UNE
 * déclinaison chez le fournisseur — la première de sa liste. Relevé le 31 août
 * sur « Robe fleurie col V » : quinze déclinaisons existaient, trois couleurs
 * fois cinq tailles, et nous vendions « Color-S ». Toute cliente aurait reçu un
 * S, quelle que soit sa demande.
 *
 * DEUX AXES, ET UN SEUL PEUT MANQUER
 *
 * Certains articles n'ont que des tailles (un tee-shirt uni), d'autres que des
 * couleurs (une coque de téléphone), la plupart les deux. Les trois cas sont
 * traités ici plutôt que dans la page : un écran qui n'en gérerait que deux
 * laisserait passer le troisième sans rien signaler.
 *
 * LA COULEUR SE MONTRE, ELLE NE SE DÉCRIT PAS
 *
 * Le fournisseur donne une photo PAR déclinaison. On l'affiche : « Abricot »
 * ne dit rien, la photo dit tout. Quand la photo manque, le nom reste.
 *
 * UNE COMBINAISON QUI N'EXISTE PAS NE DOIT PAS ÊTRE PROPOSÉE
 *
 * Le rouge existe peut-être en M et en L, mais pas en 2XL. Les tailles
 * indisponibles pour la couleur choisie sont désactivées plutôt que masquées :
 * les masquer ferait sauter les boutons d'une couleur à l'autre, et le client
 * croirait à un bug.
 */

export interface Declinaison {
  id: string;
  produit_id: string;
  couleur_fr: string | null;
  taille: string | null;
  libelle: string | null;
  photo_url: string | null;
  ordre: number;
}

interface Props {
  produitId: string;
  /** Remonte la déclinaison retenue, ou `null` tant que le choix est incomplet. */
  onChoix: (d: Declinaison | null) => void;
  /** Remonte le nombre de déclinaisons trouvées : 0 ou 1 = aucun choix à faire. */
  onNombre?: (n: number) => void;
}

/**
 * Les tailles se rangent dans l'ordre où on les essaie, pas dans l'ordre
 * alphabétique — qui placerait « XL » avant « S ».
 */
const ORDRE_TAILLES = [
  'XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL',
];

function rangTaille(t: string): number {
  const i = ORDRE_TAILLES.indexOf(t.toUpperCase());
  if (i >= 0) return i;
  // Les tailles chiffrées (chaussures, bagues) se trient entre elles, après les
  // tailles lettrées.
  const n = Number(t);
  return Number.isFinite(n) ? 1000 + n : 2000;
}

export default function ChoixDeclinaison({ produitId, onChoix, onNombre }: Props) {
  const [lignes, setLignes] = useState<Declinaison[]>([]);
  const [chargement, setChargement] = useState(true);
  const [couleur, setCouleur] = useState<string | null>(null);
  const [taille, setTaille] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    const charger = async () => {
      setChargement(true);
      const { data } = await supabase
        .from(DECLINAISONS_PUBLIC_VIEW)
        .select('*')
        .eq('produit_id', produitId)
        .order('ordre');
      if (!vivant) return;
      const l = (data as Declinaison[]) ?? [];
      setLignes(l);
      onNombre?.(l.length);
      // Une seule déclinaison n'est pas un choix : on la retient d'office plutôt
      // que d'imposer un clic qui n'a qu'une réponse possible.
      if (l.length === 1) onChoix(l[0]);
      setChargement(false);
    };
    void charger();
    return () => {
      vivant = false;
    };
    // `onChoix` et `onNombre` viennent de la page et changent à chaque rendu ;
    // les suivre relancerait la requête en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitId]);

  const couleurs = useMemo(
    () => [...new Set(lignes.map((l) => l.couleur_fr).filter(Boolean))] as string[],
    [lignes],
  );
  const tailles = useMemo(
    () =>
      ([...new Set(lignes.map((l) => l.taille).filter(Boolean))] as string[]).sort(
        (a, b) => rangTaille(a) - rangTaille(b),
      ),
    [lignes],
  );

  /** La photo qui représente une couleur : celle de sa première déclinaison. */
  const photoDe = (c: string) => lignes.find((l) => l.couleur_fr === c && l.photo_url)?.photo_url;

  const tailleDisponible = (t: string) =>
    !couleur || lignes.some((l) => l.couleur_fr === couleur && l.taille === t);

  // Le choix n'est complet que lorsque les deux axes présents sont renseignés.
  useEffect(() => {
    if (lignes.length <= 1) return;
    const trouvee = lignes.find(
      (l) =>
        (couleurs.length === 0 || l.couleur_fr === couleur) &&
        (tailles.length === 0 || l.taille === taille),
    );
    onChoix(trouvee ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couleur, taille, lignes]);

  if (chargement || lignes.length <= 1) return null;

  const bouton =
    'rounded-md border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="space-y-4">
      {couleurs.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Couleur{' '}
            {couleur ? (
              <span className="font-normal text-muted-foreground">— {couleur}</span>
            ) : (
              <span className="font-normal text-destructive">— à choisir</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {couleurs.map((c) => {
              const photo = photoDe(c);
              const actif = couleur === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => {
                    setCouleur(c);
                    // Changer de couleur peut rendre la taille choisie
                    // indisponible : on la relâche plutôt que de laisser une
                    // combinaison qui n'existe pas.
                    if (taille && !lignes.some((l) => l.couleur_fr === c && l.taille === taille)) {
                      setTaille(null);
                    }
                  }}
                  className={`${bouton} flex items-center gap-2 ${
                    actif ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-muted'
                  }`}
                >
                  {photo && (
                    <img
                      src={photo}
                      alt=""
                      loading="lazy"
                      className="h-8 w-8 shrink-0 rounded object-cover"
                    />
                  )}
                  <span>{c}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tailles.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Taille{' '}
            {taille ? (
              <span className="font-normal text-muted-foreground">— {taille}</span>
            ) : (
              <span className="font-normal text-destructive">— à choisir</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {tailles.map((t) => {
              const dispo = tailleDisponible(t);
              const actif = taille === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!dispo}
                  aria-pressed={actif}
                  title={dispo ? undefined : `Taille ${t} indisponible dans cette couleur`}
                  onClick={() => setTaille(t)}
                  className={`${bouton} min-w-12 ${
                    actif ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-muted'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
