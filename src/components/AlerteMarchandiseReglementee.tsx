import { useEffect, useState } from 'react';
import { supabase, type ControleReglementaire, type MarchandiseReglementee } from '@/lib/supabase';
import { ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * L'alerte qui doit tomber avant la commande, pas au port.
 *
 * Le fondateur a posé la règle : « il y a des articles vraiment compliqués à
 * importer, il faut faire la nuance avant que quelqu'un importe ce genre de
 * marchandise ». Un client qui découvre à l'arrivée qu'il lui fallait un
 * enregistrement AIRP a déjà payé le fournisseur, le fret et l'acconage — et sa
 * marchandise reste immobilisée pendant que les frais de séjour courent.
 *
 * Trois décisions sur le ton.
 *
 * **On avertit, on n'interdit pas.** Le client a le droit d'importer ce qu'il
 * veut s'il a le dossier. On lui dit ce qu'il lui faut, on ne bloque pas son
 * formulaire.
 *
 * **On nomme qui a le droit de demander.** C'est ce qui bloque le plus souvent,
 * et personne ne le dit : l'enregistrement des laits infantiles n'est pas
 * ouvert à n'importe quel importateur. Quelqu'un qui n'a pas la qualité requise
 * n'a pas un dossier difficile, il n'a pas de dossier du tout.
 *
 * **Le silence n'est jamais une autorisation.** Quand rien ne correspond, le
 * composant ne dit pas « c'est bon ». Il ne dit rien du tout — sauf sur les
 * écrans où l'absence de réponse serait elle-même trompeuse.
 */

const DELAI_FRAPPE_MS = 600;

const DIFFICULTE = {
  1: { texte: 'Formalité', classe: 'text-muted-foreground' },
  2: { texte: 'Dossier exigeant', classe: 'text-amber-700 dark:text-amber-500' },
  3: { texte: 'À éviter quand on démarre', classe: 'text-destructive' },
} as const;

export default function AlerteMarchandiseReglementee({
  designation,
  codeSh,
  className = '',
}: {
  designation: string;
  codeSh?: string | null;
  className?: string;
}) {
  const [controle, setControle] = useState<ControleReglementaire | null>(null);
  const [deplie, setDeplie] = useState<string | null>(null);

  useEffect(() => {
    const texte = designation.trim();
    // Deux caractères ne veulent rien dire ; interroger à chaque frappe non
    // plus. On attend que la saisie se pose.
    if (texte.length < 4 && !codeSh) {
      setControle(null);
      return;
    }
    let annule = false;
    const minuteur = setTimeout(() => {
      supabase
        .rpc('app_e08c374bc4_marchandise_reglementee', {
          p_designation: texte,
          p_code_sh: codeSh ?? null,
        })
        .then(({ data, error }) => {
          if (annule || error) return;
          setControle(data as ControleReglementaire);
        });
    }, DELAI_FRAPPE_MS);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [designation, codeSh]);

  if (!controle?.trouve || controle.fiches.length === 0) return null;

  return (
    <div className={className}>
      {controle.fiches.map((f) => (
        <Fiche
          key={f.code}
          fiche={f}
          ouvert={deplie === f.code}
          basculer={() => setDeplie(deplie === f.code ? null : f.code)}
        />
      ))}
      <p className="mt-2 text-xs text-muted-foreground">{controle.avertissement}</p>
    </div>
  );
}

function Fiche({
  fiche,
  ouvert,
  basculer,
}: {
  fiche: MarchandiseReglementee;
  ouvert: boolean;
  basculer: () => void;
}) {
  const niveau = DIFFICULTE[(fiche.difficulte as 1 | 2 | 3) ?? 2];

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Autorisation préalable obligatoire — {fiche.libelle}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fiche.autorite_sigle ?? fiche.autorite} · {fiche.base_legale}
          </p>
          <p className={'mt-1.5 text-xs font-medium ' + niveau.classe}>{niveau.texte}</p>

          <p className="mt-2 text-sm text-foreground">{fiche.document_requis}.</p>

          {fiche.conseil_demarrage && (
            <p className="mt-2 text-sm text-muted-foreground">{fiche.conseil_demarrage}</p>
          )}

          <button
            type="button"
            onClick={basculer}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {ouvert ? 'Masquer le détail' : 'Voir qui peut demander et ce que contient le dossier'}
            {ouvert ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {ouvert && (
            <div className="mt-3 space-y-3 border-t border-destructive/20 pt-3">
              {fiche.personnes_morales_autorisees.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Qui peut déposer la demande
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                    {fiche.personnes_morales_autorisees.map((p) => (
                      <li key={p}>— {p}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Hors de ces qualités, la demande n'est pas recevable : ce n'est pas un dossier
                    difficile, c'est un dossier impossible.
                  </p>
                </div>
              )}

              {fiche.pieces_du_dossier.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pièces du dossier
                    {fiche.exemplaires ? ` — en ${fiche.exemplaires} exemplaires` : ''}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                    {fiche.pieces_du_dossier.map((p) => (
                      <li key={p}>— {p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(fiche.adresse_depot || fiche.contact) && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Où déposer
                  </p>
                  {fiche.adresse_depot && (
                    <p className="mt-1 text-sm text-foreground">{fiche.adresse_depot}</p>
                  )}
                  {fiche.contact && (
                    <p className="text-sm text-muted-foreground">{fiche.contact}</p>
                  )}
                  {fiche.site_web && (
                    <a
                      href={fiche.site_web}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {fiche.site_web}
                    </a>
                  )}
                </div>
              )}

              {fiche.note && (
                <p className="text-xs text-muted-foreground">{fiche.note}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
