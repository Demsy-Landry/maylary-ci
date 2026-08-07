import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import AdminNav from '@/components/AdminNav';
import {
  supabase,
  VENDEURS_TABLE,
  REVERSEMENTS_TABLE,
  REVERSEMENTS_DUS_VIEW,
  PARAMETRES_GARANTIE_TABLE,
  PARAMETRES_MARKETPLACE_TABLE,
  STATUT_VENDEUR_LABELS,
  MODE_REVERSEMENT_LABELS,
  type ParametresMarketplace,
  type ReversementsDus,
  type StatutVendeur,
  type Vendeur,
} from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, Ban, Pencil, Wallet, Save } from 'lucide-react';

const BADGE_VARIANT: Record<StatutVendeur, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  en_attente: 'outline',
  valide: 'default',
  suspendu: 'destructive',
  refuse: 'destructive',
};

/**
 * Le solde n'est plus calculé ici.
 *
 * L'écran additionnait les ventes nettes et retranchait les versements — sans
 * savoir si les colis étaient arrivés. La garantie « payé, protégé » exige la
 * distinction, et la base la fait : `app_e08c374bc4_reversements_dus` sépare ce
 * qui est libéré de ce qui reste retenu, et un déclencheur refuse tout
 * versement au-delà du libéré. Recalculer côté écran ne ferait que produire un
 * second chiffre, faux le jour où les deux divergent.
 */
const SOLDE_VIDE: ReversementsDus = {
  vendeur_id: '',
  nom_entreprise: '',
  libere_fcfa: 0,
  retenu_fcfa: 0,
  en_cours_fcfa: 0,
  deja_reverse_fcfa: 0,
  disponible_fcfa: 0,
};

export default function AdminVendeursGestion() {
  const [vendeurs, setVendeurs] = useState<Vendeur[]>([]);
  const [soldes, setSoldes] = useState<Record<string, ReversementsDus>>({});
  const [parametres, setParametres] = useState<ParametresMarketplace | null>(null);
  const [loading, setLoading] = useState(true);
  const [ouvert, setOuvert] = useState<Vendeur | null>(null);
  const [busy, setBusy] = useState(false);

  const [motif, setMotif] = useState('');
  const [taux, setTaux] = useState('');
  const [montantVersement, setMontantVersement] = useState('');
  const [refReglement, setRefReglement] = useState('');

  const [tauxDefaut, setTauxDefaut] = useState('');
  const [delaiReversement, setDelaiReversement] = useState('');
  const [delaiGarantie, setDelaiGarantie] = useState('');

  const charger = async () => {
    setLoading(true);
    const [vRes, dRes, pRes, gRes] = await Promise.all([
      supabase.from(VENDEURS_TABLE).select('*').order('created_at', { ascending: false }),
      supabase.from(REVERSEMENTS_DUS_VIEW).select('*'),
      supabase.from(PARAMETRES_MARKETPLACE_TABLE).select('*').eq('id', 1).maybeSingle(),
      supabase.from(PARAMETRES_GARANTIE_TABLE).select('delai_confirmation_jours').maybeSingle(),
    ]);

    setVendeurs((vRes.data as Vendeur[]) ?? []);

    const agrege: Record<string, ReversementsDus> = {};
    for (const d of ((dRes.data ?? []) as ReversementsDus[])) {
      agrege[d.vendeur_id] = {
        ...d,
        libere_fcfa: Number(d.libere_fcfa),
        retenu_fcfa: Number(d.retenu_fcfa),
        en_cours_fcfa: Number(d.en_cours_fcfa),
        deja_reverse_fcfa: Number(d.deja_reverse_fcfa),
        disponible_fcfa: Number(d.disponible_fcfa),
      };
    }
    setSoldes(agrege);

    if (gRes.data) setDelaiGarantie(String(gRes.data.delai_confirmation_jours));

    const p = pRes.data as ParametresMarketplace | null;
    setParametres(p);
    if (p) {
      setTauxDefaut(String(Number(p.taux_commission_defaut) * 100));
      setDelaiReversement(String(p.delai_reversement_jours));
    }
    setLoading(false);
  };

  useEffect(() => {
    charger();
  }, []);

  const enAttente = useMemo(() => vendeurs.filter((v) => v.statut === 'en_attente'), [vendeurs]);

  const ouvrir = (v: Vendeur) => {
    setOuvert(v);
    setMotif(v.motif_statut ?? '');
    setTaux(v.taux_commission != null ? String(Number(v.taux_commission) * 100) : '');
    const s = soldes[v.id] ?? SOLDE_VIDE;
    setMontantVersement(String(Math.max(0, s.disponible_fcfa)));
    setRefReglement('');
  };

  const changerStatut = async (statut: StatutVendeur) => {
    if (!ouvert) return;
    if ((statut === 'suspendu' || statut === 'refuse') && !motif.trim()) {
      toast.error('Un motif est requis : le vendeur doit savoir pourquoi.');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from(VENDEURS_TABLE)
      .update({
        statut,
        motif_statut: motif.trim() || null,
        valide_le: statut === 'valide' ? new Date().toISOString() : ouvert.valide_le,
      })
      .eq('id', ouvert.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      statut === 'valide'
        ? 'Vendeur validé : son catalogue peut être publié.'
        : 'Statut mis à jour.',
    );
    setOuvert(null);
    charger();
  };

  const enregistrerTaux = async () => {
    if (!ouvert) return;
    // Un champ vide remet le vendeur sur le taux général : c'est la façon de
    // révoquer un accord particulier sans avoir à retenir le taux d'origine.
    const valeur = taux.trim() === '' ? null : Number(taux) / 100;
    if (valeur !== null && (!Number.isFinite(valeur) || valeur < 0 || valeur >= 1)) {
      toast.error('Taux invalide (0 à 99 %).');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from(VENDEURS_TABLE)
      .update({ taux_commission: valeur })
      .eq('id', ouvert.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(valeur === null ? 'Retour au taux général.' : 'Taux particulier enregistré.');
    charger();
  };

  const enregistrerVersement = async () => {
    if (!ouvert) return;
    const montant = Number(montantVersement);
    if (!Number.isFinite(montant) || montant <= 0) {
      toast.error('Montant invalide.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from(REVERSEMENTS_TABLE).insert({
      vendeur_id: ouvert.id,
      montant_fcfa: Math.round(montant),
      mode_reglement: ouvert.mode_reversement,
      reference_reglement: refReglement.trim() || null,
      statut: 'paye',
      paye_le: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Versement enregistré.');
    setOuvert(null);
    charger();
  };

  const enregistrerParametres = async () => {
    const t = Number(tauxDefaut) / 100;
    const d = Number(delaiReversement);
    if (!Number.isFinite(t) || t < 0 || t >= 1) {
      toast.error('Taux général invalide (0 à 99 %).');
      return;
    }
    const g = Math.round(Number(delaiGarantie));
    if (!Number.isFinite(g) || g < 1) {
      toast.error('Le délai de contestation doit valoir au moins un jour.');
      return;
    }
    setBusy(true);
    const [marche, garantie] = await Promise.all([
      supabase
        .from(PARAMETRES_MARKETPLACE_TABLE)
        .update({
          taux_commission_defaut: t,
          delai_reversement_jours: Number.isFinite(d) ? Math.max(0, Math.round(d)) : 7,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1),
      supabase
        .from(PARAMETRES_GARANTIE_TABLE)
        .update({ delai_confirmation_jours: g, updated_at: new Date().toISOString() })
        .eq('ligne_unique', true),
    ]);
    setBusy(false);
    const error = marche.error ?? garantie.error;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Conditions de la place mises à jour.');
    charger();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">
              Admin — Vendeurs de la marketplace
            </h1>
          </div>
          {enAttente.length > 0 && (
            <Badge variant="outline" className="border-primary text-primary-emphasis">
              {enAttente.length} dossier(s) à examiner
            </Badge>
          )}
        </div>
      </header>

      <main className="entree-page mx-auto max-w-screen-xl space-y-6 px-4 py-8 sm:px-6">
        {/* Conditions générales de la place */}
        <section className="carte-reactive rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Conditions de la place</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            S'appliquent à tout vendeur sans accord particulier. Une modification ne touche jamais
            les ventes déjà conclues : leur taux est figé sur la ligne de commande.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="td">Commission de service (%)</Label>
              <Input
                id="td"
                type="number"
                step="0.1"
                className="w-40"
                value={tauxDefaut}
                onChange={(e) => setTauxDefaut(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr">Délai de reversement (jours)</Label>
              <Input
                id="dr"
                type="number"
                className="w-40"
                value={delaiReversement}
                onChange={(e) => setDelaiReversement(e.target.value)}
              />
            </div>
            {/* Le réglage le plus sensible de la place de marché : trop court,
                l'acheteur n'a pas le temps de contester ; trop long, aucune
                entreprise n'accepte de vendre ici. */}
            <div className="space-y-1.5">
              <Label htmlFor="dg">Délai de contestation (jours)</Label>
              <Input
                id="dg"
                type="number"
                min={1}
                className="w-40"
                value={delaiGarantie}
                onChange={(e) => setDelaiGarantie(e.target.value)}
              />
              <p className="max-w-xs text-xs text-muted-foreground">
                Passé ce délai sans réponse de l'acheteur, la commande est réputée reçue et
                l'argent du vendeur se libère.
              </p>
            </div>
            <Button variant="outline" onClick={enregistrerParametres} disabled={busy}>
              <Save className="mr-1.5 h-4 w-4" />
              Enregistrer
            </Button>
          </div>
        </section>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : vendeurs.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucune entreprise inscrite pour le moment.
          </p>
        ) : (
          <div className="cascade divide-y rounded-md border">
            {vendeurs.map((v) => {
              const s = soldes[v.id] ?? SOLDE_VIDE;
              const du = s.disponible_fcfa;
              return (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{v.nom_entreprise}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.reference_publique} · {v.ville ?? 'ville non précisée'} · {v.telephone}
                      {du > 0 && ` · ${du.toLocaleString('fr-FR')} FCFA à verser`}
                      {s.retenu_fcfa > 0 &&
                        ` · ${s.retenu_fcfa.toLocaleString('fr-FR')} FCFA retenus`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={BADGE_VARIANT[v.statut]}>{STATUT_VENDEUR_LABELS[v.statut]}</Badge>
                    <Button variant="outline" size="sm" onClick={() => ouvrir(v)}>
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Gérer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={!!ouvert} onOpenChange={(o) => !o && setOuvert(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{ouvert?.nom_entreprise}</DialogTitle>
          </DialogHeader>
          {ouvert && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm">
                <p className="text-muted-foreground">
                  {ouvert.reference_publique} · {ouvert.telephone}
                  {ouvert.email_contact ? ` · ${ouvert.email_contact}` : ''}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {ouvert.adresse ? `${ouvert.adresse}, ` : ''}
                  {ouvert.ville ?? '—'}
                </p>
                <p className="mt-1 text-muted-foreground">
                  RC {ouvert.registre_commerce ?? '—'} · Contribuable{' '}
                  {ouvert.numero_contribuable ?? '—'}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Reversement : {MODE_REVERSEMENT_LABELS[ouvert.mode_reversement]} —{' '}
                  {ouvert.compte_reversement ?? 'non renseigné'} ({ouvert.titulaire_compte ?? '—'})
                </p>
                {ouvert.description && (
                  <p className="mt-2 text-muted-foreground">{ouvert.description}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="motif">Message au vendeur (requis pour refuser ou suspendre)</Label>
                <Textarea
                  id="motif"
                  rows={2}
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="ex : registre de commerce illisible, merci de le renvoyer"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => changerStatut('valide')} disabled={busy}>
                  {busy ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  )}
                  Valider
                </Button>
                <Button variant="outline" onClick={() => changerStatut('suspendu')} disabled={busy}>
                  <Ban className="mr-1.5 h-4 w-4" />
                  Suspendre
                </Button>
                <Button variant="outline" onClick={() => changerStatut('refuse')} disabled={busy}>
                  Refuser
                </Button>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <Label htmlFor="tx">Taux particulier (%) — vide = taux général</Label>
                <div className="flex gap-2">
                  <Input
                    id="tx"
                    type="number"
                    step="0.1"
                    value={taux}
                    onChange={(e) => setTaux(e.target.value)}
                    placeholder={String(Number(parametres?.taux_commission_defaut ?? 0) * 100)}
                  />
                  <Button variant="outline" onClick={enregistrerTaux} disabled={busy}>
                    Appliquer
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Wallet className="h-4 w-4" />
                  Verser au vendeur
                </p>
                {/* Le détail plutôt qu'un total : l'administration doit voir
                    pourquoi une somme n'est pas versable, sinon elle croit à
                    une erreur et cherche à forcer. */}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <dt>Réception acquise</dt>
                  <dd className="text-right tabular-nums text-foreground">
                    {(soldes[ouvert.id]?.libere_fcfa ?? 0).toLocaleString('fr-FR')} FCFA
                  </dd>
                  <dt>Retenu — livré, délai en cours</dt>
                  <dd className="text-right tabular-nums">
                    {(soldes[ouvert.id]?.retenu_fcfa ?? 0).toLocaleString('fr-FR')} FCFA
                  </dd>
                  <dt>En cours — payé, pas encore livré</dt>
                  <dd className="text-right tabular-nums">
                    {(soldes[ouvert.id]?.en_cours_fcfa ?? 0).toLocaleString('fr-FR')} FCFA
                  </dd>
                  <dt>Déjà versé</dt>
                  <dd className="text-right tabular-nums">
                    {(soldes[ouvert.id]?.deja_reverse_fcfa ?? 0).toLocaleString('fr-FR')} FCFA
                  </dd>
                  <dt className="font-medium text-foreground">Versable maintenant</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">
                    {(soldes[ouvert.id]?.disponible_fcfa ?? 0).toLocaleString('fr-FR')} FCFA
                  </dd>
                </dl>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    type="number"
                    value={montantVersement}
                    onChange={(e) => setMontantVersement(e.target.value)}
                    placeholder="Montant (FCFA)"
                  />
                  <Input
                    value={refReglement}
                    onChange={(e) => setRefReglement(e.target.value)}
                    placeholder="Référence du transfert"
                  />
                </div>
                <Button size="sm" onClick={enregistrerVersement} disabled={busy}>
                  Enregistrer le versement
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
