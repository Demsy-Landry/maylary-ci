import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

/**
 * Une liste qu'on cherche au clavier.
 *
 * Le fondateur : « il y a des cases qui n'ont pas besoin d'être réécrites mais
 * sélectionnées dans une liste ». Il a raison, et le motif va plus loin qu'un
 * confort de saisie : une case tapée à la main est fausse une fois sur dix.
 * « Cote d'ivoire », « CIV », « RCI » désignent le même pays et se ressaisissent
 * différemment dans SYDAM. Le code ISO, lui, ne se discute pas.
 *
 * POURQUOI PAS UN `<select>` NATIF
 *
 * Deux cents pays dans un menu déroulant natif, sur un téléphone, c'est un
 * défilement interminable. Ici on tape trois lettres. Le champ reste un
 * `<input>` : le clavier du téléphone s'ouvre normalement, et rien n'est
 * réinventé de ce que le navigateur sait déjà faire.
 *
 * CE QU'IL FAIT QU'UNE LISTE ORDINAIRE NE FAIT PAS
 *
 * **Il cherche dans le code ET dans le libellé.** Un déclarant qui connaît
 * « CN » ne veut pas taper « Chine », et l'inverse est vrai du débutant.
 *
 * **Il accepte une valeur hors liste quand on le lui permet.** Un bureau de
 * douane qui vient d'ouvrir, un pays absent : refuser bloquerait la
 * déclaration. `libre` autorise la saisie, et l'écran le signale.
 */

export interface OptionListe {
  valeur: string;
  libelle: string;
  /** Deuxième ligne : aide, ville, appartenance régionale. */
  detail?: string;
  /** Remonte en tête, avant le tri alphabétique. */
  courant?: boolean;
}

interface Props {
  id?: string;
  options: OptionListe[];
  valeur: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Autorise une valeur qui n'est pas dans la liste. */
  libre?: boolean;
  /** Affiché sous le champ quand la valeur est hors liste. */
  aideLibre?: string;
}

/** Sans accents ni casse : « Côte d'Ivoire » se trouve en tapant « cote ». */
const normaliser = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function ChoixListe({
  id,
  options,
  valeur,
  onChange,
  placeholder,
  libre = false,
  aideLibre,
}: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');
  const boite = useRef<HTMLDivElement>(null);

  const choisie = options.find((o) => o.valeur === valeur) ?? null;
  /* Tant que la liste n'est pas arrivée, on ne peut RIEN dire de la valeur.
   * Sans ce garde-fou, l'écran affichait « valeur hors liste » sous un régime
   * 4000 parfaitement valide, le temps que le référentiel se charge — et
   * accusait la saisie du fondateur d'une faute qu'elle n'avait pas. */
  const horsListe = options.length > 0 && valeur !== '' && !choisie;

  // Un clic ailleurs referme. Sans cela, la liste reste ouverte par-dessus le
  // champ suivant et on croit avoir cliqué à côté.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);

  const filtrees = useMemo(() => {
    const q = normaliser(recherche.trim());
    const gardees = q
      ? options.filter(
          (o) =>
            normaliser(o.libelle).includes(q) ||
            normaliser(o.valeur).includes(q) ||
            (o.detail ? normaliser(o.detail).includes(q) : false),
        )
      : options;
    // Les courants d'abord, puis l'ordre reçu : le classement métier prime sur
    // l'alphabet — on importe cent fois de Chine pour une fois du Chili.
    return [...gardees].sort((a, b) => Number(!!b.courant) - Number(!!a.courant)).slice(0, 80);
  }, [options, recherche]);

  const retenir = (o: OptionListe) => {
    onChange(o.valeur);
    setRecherche('');
    setOuvert(false);
  };

  return (
    <div ref={boite} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={ouvert}
          aria-autocomplete="list"
          value={ouvert ? recherche : (choisie?.libelle ?? valeur)}
          onChange={(e) => {
            setRecherche(e.target.value);
            if (!ouvert) setOuvert(true);
            // En mode libre, ce qu'on tape est la valeur : la liste n'est
            // qu'une aide, pas une contrainte.
            if (libre) onChange(e.target.value);
          }}
          onFocus={() => {
            setOuvert(true);
            setRecherche('');
          }}
          placeholder={placeholder ?? 'Chercher…'}
          className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 pr-14 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {valeur && (
            <button
              type="button"
              aria-label="Effacer"
              onClick={() => {
                onChange('');
                setRecherche('');
              }}
              className="pointer-events-auto rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Le code retenu, sous le champ : c'est LUI qui part sur la déclaration,
          et le déclarant doit le voir sans ouvrir la liste. */}
      {choisie && choisie.valeur !== choisie.libelle && (
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          Code retenu : <strong className="text-foreground">{choisie.valeur}</strong>
        </p>
      )}
      {horsListe && (
        <p className="mt-0.5 text-xs text-amber-700">
          {aideLibre ?? 'Valeur hors liste — vérifiez-la avant le dépôt.'}
        </p>
      )}

      {ouvert && (
        <ul
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-card p-1 shadow-lg"
        >
          {filtrees.length === 0 ? (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground">
              {libre ? 'Aucune correspondance — votre saisie sera conservée.' : 'Aucune correspondance.'}
            </li>
          ) : (
            filtrees.map((o) => (
              <li key={o.valeur}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.valeur === valeur}
                  onClick={() => retenir(o)}
                  className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
                >
                  <Check
                    className={
                      'mt-0.5 h-3.5 w-3.5 shrink-0 ' +
                      (o.valeur === valeur ? 'text-primary' : 'invisible')
                    }
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">
                      {o.libelle}
                      {o.valeur !== o.libelle && (
                        <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                          {o.valeur}
                        </span>
                      )}
                    </span>
                    {o.detail && (
                      <span className="block text-xs text-muted-foreground">{o.detail}</span>
                    )}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
