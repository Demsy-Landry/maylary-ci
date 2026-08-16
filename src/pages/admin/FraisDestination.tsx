import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  FRAIS_DESTINATION_TABLE,
  REPERES_FRET_MARCHE_TABLE,
} from '@/lib/supabase';
import type { FraisDestination, BaseCalcul } from '@/lib/frais-destination';
import AdminNav from '@/components/AdminNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Anchor, Plane, Loader2, TriangleAlert, Info } from 'lucide-react';

/**
 * Les frais que la compagnie et le port réclament à l'arrivée.
 *
 * POURQUOI CET ÉCRAN A DÛ ÊTRE CRÉÉ
 *
 * Le fondateur : « Il ne suffit pas de payer la marchandise, payer le fret,
 * faire l'assurance et liquider les droits et taxes pour que la marchandise
 * soit livrée. » Notre chiffrage s'arrêtait au Bon À Enlever. Entre le BAE et
 * le camion il reste une facture — acconage, échange du connaissement,
 * magasinage au port ; retrait documentaire et magasinage à l'aéroport — et
 * elle n'est émise ni par la douane ni par le fournisseur.
 *
 * POURQUOI LES MONTANTS SONT VIDES
 *
 * Parce que je ne les connais pas, et qu'un acconage plausible mais faux ne se
 * découvre pas au devis : il se découvre à la caisse du terminal, marchandise
 * déjà à quai. Tant qu'un poste applicable n'a pas son montant, le chiffrage
 * REFUSE de conclure et nomme ce qui lui manque — la même règle que pour un
 * code absent du Tarif Extérieur Commun.
 *
 * Les chiffres à porter ici se lisent sur une facture de compagnie ou sur le
 * tarif publié du terminal. Une fois saisis, cocher « vérifié ».
 *
 * CE QUI N'EST PAS CONCERNÉ
 *
 * La boutique en dropshipping : le porte-à-porte droits acquittés n'a ni
 * connaissement à échanger, ni acconier, ni magasin sous douane. Ces frais sont
 * déjà dans le prix du transporteur, les compter ici les compterait deux fois.
 */

const BASES: { valeur: BaseCalcul; libelle: string; unite: string }[] = [
  { valeur: 'forfait_expedition', libelle: 'Forfait par expédition', unite: 'FCFA' },
  { valeur: 'par_conteneur', libelle: 'Par conteneur', unite: 'FCFA / conteneur' },
  { valeur: 'par_tonne', libelle: 'Par tonne', unite: 'FCFA / tonne' },
  { valeur: 'par_m3', libelle: 'Par mètre cube', unite: 'FCFA / m³' },
  { valeur: 'par_kg', libelle: 'Par kilo', unite: 'FCFA / kg' },
  { valeur: 'par_jour', libelle: 'Par jour', unite: 'FCFA / jour' },
  { valeur: 'pourcentage_caf', libelle: 'Pourcentage de la valeur CAF', unite: '%' },
];

const uniteDe = (b: BaseCalcul) => BASES.find((x) => x.valeur === b)?.unite ?? 'FCFA';

interface Repere {
  origine: string;
  mode: string;
  conditionnement: string;
  unite: string;
  courant_min: number | null;
  courant_max: number | null;
  montant_min: number | null;
  montant_max: number | null;
  devise: string;
  avertissement: string | null;
}

export default function FraisDestinationReglages() {
  const [postes, setPostes] = useState<FraisDestination[]>([]);
  const [reperes, setReperes] = useState<Repere[]>([]);
  const [brouillon, setBrouillon] = useState<Record<string, string>>({});
  const [franchises, setFranchises] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(true);
  const [echec, setEchec] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState<string | null>(null);

  const charger = async () => {
    setChargement(true);
    setEchec(null);
    const [postesRes, reperesRes] = await Promise.all([
      supabase.from(FRAIS_DESTINATION_TABLE).select('*').order('ordre'),
      supabase
        .from(REPERES_FRET_MARCHE_TABLE)
        .select(
          'origine, mode, conditionnement, unite, courant_min, courant_max, montant_min, montant_max, devise, avertissement',
        )
        .eq('actif', true)
        .order('mode')
        .order('origine'),
    ]);

    /* Une lecture qui échoue ne doit PAS s'afficher « aucun poste » : on
       croirait le barème vide alors qu'il est seulement inaccessible. */
    if (postesRes.error) {
      setEchec("Le barème n'a pas pu être lu.");
      setChargement(false);
      return;
    }

    const lignes = (postesRes.data as FraisDestination[]) ?? [];
    setPostes(lignes);
    setReperes((reperesRes.data as Repere[]) ?? []);
    setBrouillon(
      Object.fromEntries(
        lignes.map((p) => [
          p.code,
          p.base_calcul === 'pourcentage_caf'
            ? p.taux != null
              ? String(p.taux * 100)
              : ''
            : p.montant_fcfa != null
              ? String(p.montant_fcfa)
              : '',
        ]),
      ),
    );
    setFranchises(
      Object.fromEntries(
        lignes.map((p) => [p.code, p.franchise_jours != null ? String(p.franchise_jours) : '']),
      ),
    );
    setChargement(false);
  };

  useEffect(() => {
    charger();
  }, []);

  const enregistrer = async (poste: FraisDestination) => {
    const saisi = (brouillon[poste.code] ?? '').trim();
    const franchise = (franchises[poste.code] ?? '').trim();

    /* Vider le champ REMET le poste à « non renseigné » : c'est un état utile,
       pas une erreur de saisie. Un tarif effacé doit refaire refuser le
       chiffrage plutôt que de garder la dernière valeur connue. */
    const valeur = saisi === '' ? null : Number(saisi.replace(',', '.'));
    if (valeur !== null && !Number.isFinite(valeur)) {
      toast.error('Montant illisible.');
      return;
    }

    const maj: Record<string, unknown> = {
      franchise_jours: franchise === '' ? null : Number(franchise),
      /* Le montant vient d'une facture ou d'un tarif publié : c'est ce que
         « vérifié » veut dire, et seule une saisie humaine peut l'affirmer. */
      verifie: valeur !== null,
      updated_at: new Date().toISOString(),
    };
    if (poste.base_calcul === 'pourcentage_caf') {
      maj.taux = valeur === null ? null : valeur / 100;
    } else {
      maj.montant_fcfa = valeur;
    }

    const { error } = await supabase
      .from(FRAIS_DESTINATION_TABLE)
      .update(maj)
      .eq('code', poste.code);
    if (error) {
      toast.error("Le montant n'a pas été enregistré.");
      return;
    }
    setEnregistre(poste.code);
    setTimeout(() => setEnregistre(null), 2000);
    charger();
  };

  const maritimes = postes.filter((p) => p.mode === 'maritime' || p.mode === 'tous');
  const aeriens = postes.filter((p) => p.mode === 'aerien');
  const aRenseigner = postes.filter(
    (p) => p.actif && (p.base_calcul === 'pourcentage_caf' ? p.taux == null : p.montant_fcfa == null),
  );

  const Poste = ({ p }: { p: FraisDestination }) => {
    const renseigne = p.base_calcul === 'pourcentage_caf' ? p.taux != null : p.montant_fcfa != null;
    return (
      <div className="border-b p-4 last:border-b-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{p.libelle}</p>
            <p className="text-xs text-muted-foreground">
              {p.percepteur} · {BASES.find((b) => b.valeur === p.base_calcul)?.libelle}
              {p.conditionnement !== 'tous' && ` · ${p.conditionnement}`}
            </p>
          </div>
          {renseigne ? (
            <Badge variant="secondary">Renseigné</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
              À renseigner
            </Badge>
          )}
        </div>

        {p.note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.note}</p>}

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{uniteDe(p.base_calcul)}</span>
            <Input
              inputMode="decimal"
              className="w-40 tabular-nums"
              placeholder="non renseigné"
              value={brouillon[p.code] ?? ''}
              onChange={(e) => setBrouillon((b) => ({ ...b, [p.code]: e.target.value }))}
            />
          </label>

          {p.base_calcul === 'par_jour' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Franchise (jours)</span>
              <Input
                inputMode="numeric"
                className="w-32 tabular-nums"
                placeholder="0"
                value={franchises[p.code] ?? ''}
                onChange={(e) => setFranchises((f) => ({ ...f, [p.code]: e.target.value }))}
              />
            </label>
          )}

          <Button size="sm" onClick={() => enregistrer(p)}>
            {enregistre === p.code ? 'Enregistré' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="entree-page mx-auto max-w-screen-lg px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Frais de destination
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ce que la compagnie et le port réclament à l’arrivée, en plus des droits et taxes.
          Sans eux, un devis d’import est incomplet du même montant à chaque dossier.
        </p>

        {chargement ? (
          <div className="mt-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : echec ? (
          <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground">
            {echec}
          </p>
        ) : (
          <>
            {aRenseigner.length > 0 && (
              <div className="mt-6 flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    {aRenseigner.length} poste{aRenseigner.length > 1 ? 's' : ''} sans montant.
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    Tant qu’ils sont vides, le chiffrage d’un import refuse de conclure et dit
                    lequel lui manque. C’est voulu : un acconage inventé se découvrirait à la
                    caisse du terminal, marchandise déjà à quai. Les montants se lisent sur une
                    facture de compagnie ou sur le tarif publié du terminal.
                  </p>
                </div>
              </div>
            )}

            <section className="mt-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <Anchor className="h-4 w-4 text-primary" />
                Maritime
              </h2>
              <div className="mt-2 rounded-md border bg-card">
                {maritimes.map((p) => (
                  <Poste key={p.code} p={p} />
                ))}
              </div>
            </section>

            <section className="mt-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <Plane className="h-4 w-4 text-primary" />
                Aérien
              </h2>
              <div className="mt-2 rounded-md border bg-card">
                {aeriens.map((p) => (
                  <Poste key={p.code} p={p} />
                ))}
              </div>
            </section>

            {reperes.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-lg font-bold text-foreground">
                  Fourchettes de fret du marché
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pour situer un fret annoncé. La colonne du milieu est la fourchette la plus
                  fréquemment observée — c’est sur elle qu’on chiffre, pas sur le minimum absolu.
                </p>

                <div className="mt-3 overflow-x-auto rounded-md border bg-card">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="p-2 text-left font-medium">Origine</th>
                        <th className="p-2 text-left font-medium">Mode</th>
                        <th className="p-2 text-left font-medium">Unité</th>
                        <th className="p-2 text-right font-medium">Plancher</th>
                        <th className="p-2 text-right font-medium">Courant</th>
                        <th className="p-2 text-right font-medium">Plafond</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reperes.map((r, i) => (
                        <tr key={i} className="border-b last:border-b-0">
                          <td className="p-2">{r.origine}</td>
                          <td className="p-2 text-muted-foreground">
                            {r.mode === 'maritime'
                              ? r.conditionnement === 'conteneur'
                                ? 'Maritime, conteneur'
                                : 'Maritime, groupage'
                              : 'Aérien'}
                          </td>
                          <td className="p-2 text-muted-foreground">{r.unite}</td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">
                            {r.montant_min} {r.devise}
                          </td>
                          <td className="p-2 text-right font-medium tabular-nums text-foreground">
                            {r.courant_min} – {r.courant_max}
                          </td>
                          <td className="p-2 text-right tabular-nums text-muted-foreground">
                            {r.montant_max} {r.devise}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* L'avertissement ne s'affiche jamais séparé du tableau : un
                    repère de marché pris pour un barème douanier conduirait à
                    contester un redressement sur une base qui n'existe pas. */}
                {reperes[0]?.avertissement && (
                  <div className="mt-3 flex gap-2.5 rounded-md bg-muted/50 p-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {reperes[0].avertissement} Les tarifs les plus bas publiés par les agents
                      sont des tarifs de base hors surcharges — soutes, THC, documentation, frais
                      locaux — et le marché bouge de 20 à 30 % en un mois.
                    </p>
                  </div>
                )}
              </section>
            )}

            <Button variant="outline" size="sm" className="mt-6" onClick={charger}>
              {chargement ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Recharger
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
