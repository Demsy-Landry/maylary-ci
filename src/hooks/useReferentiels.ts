import { useEffect, useState } from 'react';
import { supabase, REGIMES_DOUANIERS_TABLE, type RegimeDouanier } from '@/lib/supabase';
import type { OptionListe } from '@/components/ChoixListe';

/**
 * Les listes de la déclaration, chargées une fois.
 *
 * Elles viennent toutes de la base — aucune n'est écrite en dur dans l'écran.
 * C'est ce qui permet au fondateur d'ajouter un bureau de douane ou de
 * corriger un libellé sans redéploiement, et ce qui évite la divergence
 * classique entre la liste affichée et la liste réellement utilisée par le
 * moteur de liquidation.
 *
 * Tout part en un seul aller-retour groupé plutôt qu'en six : sur une liaison
 * mobile abidjanaise, six requêtes en série font attendre le formulaire une
 * seconde de plus pour rien.
 */

export interface Referentiels {
  pays: OptionListe[];
  bureaux: OptionListe[];
  monnaies: OptionListe[];
  modesTransport: OptionListe[];
  naturesTransaction: OptionListe[];
  typesColis: OptionListe[];
  typesDeclaration: OptionListe[];
  regimes: OptionListe[];
  incoterms: OptionListe[];
  pret: boolean;
}

const VIDE: Referentiels = {
  pays: [],
  bureaux: [],
  monnaies: [],
  modesTransport: [],
  naturesTransaction: [],
  typesColis: [],
  typesDeclaration: [],
  regimes: [],
  incoterms: [],
  pret: false,
};

export function useReferentiels(): Referentiels {
  const [r, setR] = useState<Referentiels>(VIDE);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      const [pays, bureaux, monnaies, nomenclatures, regimes, incoterms] = await Promise.all([
        supabase.from('app_e08c374bc4_pays').select('*').order('nom'),
        supabase.from('app_e08c374bc4_bureaux_douane').select('*').eq('actif', true).order('ordre'),
        supabase.from('app_e08c374bc4_monnaies').select('*').order('ordre'),
        supabase.from('app_e08c374bc4_nomenclatures').select('*').order('ordre'),
        supabase.from(REGIMES_DOUANIERS_TABLE).select('*').order('ordre'),
        supabase.from('app_e08c374bc4_parametres_incoterm').select('*').order('ordre_affichage'),
      ]);
      if (annule) return;

      const nomencl = (famille: string): OptionListe[] =>
        ((nomenclatures.data as { famille: string; code: string; libelle: string; aide: string | null }[]) ?? [])
          .filter((n) => n.famille === famille)
          .map((n) => ({ valeur: n.code, libelle: n.libelle, detail: n.aide ?? undefined }));

      setR({
        pays: ((pays.data as { code: string; nom: string; uemoa: boolean; cedeao: boolean; courant: boolean }[]) ?? []).map(
          (p) => ({
            valeur: p.code,
            libelle: p.nom,
            // L'appartenance régionale décide du régime préférentiel : elle a
            // sa place sous le nom, pas dans une note de bas de page.
            detail: p.uemoa ? 'UEMOA · CEDEAO' : p.cedeao ? 'CEDEAO' : undefined,
            courant: p.courant,
          }),
        ),

        bureaux: ((bureaux.data as { nom: string; code: string | null; ville: string | null; code_verifie: boolean }[]) ?? []).map(
          (b) => ({
            // Tant que le code SYDAM n'est pas confirmé, c'est le NOM qui fait
            // valeur : un code inventé ferait rejeter la déclaration au dépôt.
            valeur: b.code ?? b.nom,
            libelle: b.nom,
            detail: b.code_verifie ? (b.ville ?? undefined) : `${b.ville ?? ''} — code à confirmer`.trim(),
          }),
        ),

        monnaies: ((monnaies.data as { code: string; nom: string; parite_xof_fixe: number | null; courant: boolean }[]) ?? []).map(
          (m) => ({
            valeur: m.code,
            libelle: `${m.nom} (${m.code})`,
            detail:
              m.parite_xof_fixe && m.code !== 'XOF'
                ? `Parité fixe : ${m.parite_xof_fixe} XOF`
                : undefined,
            courant: m.courant,
          }),
        ),

        modesTransport: nomencl('mode_transport'),
        naturesTransaction: nomencl('nature_transaction'),
        typesColis: nomencl('type_colis'),
        typesDeclaration: nomencl('type_declaration'),

        regimes: ((regimes.data as RegimeDouanier[]) ?? []).map((g) => ({
          valeur: g.code,
          libelle: g.libelle,
          detail: [
            g.sens === 'import' ? 'Import' : g.sens === 'export' ? 'Export' : null,
            g.caution_requise ? 'caution exigée' : null,
            g.depend_autorisation ? 'autorisation requise' : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
          courant: g.code === '4000',
        })),

        incoterms: ((incoterms.data as { incoterm: string; libelle: string; point_transfert: string | null }[]) ?? []).map(
          (i) => ({
            valeur: i.incoterm,
            libelle: `${i.incoterm} — ${i.libelle}`,
            detail: i.point_transfert ?? undefined,
          }),
        ),

        pret: true,
      });
    };

    void charger();
    return () => {
      annule = true;
    };
  }, []);

  return r;
}
