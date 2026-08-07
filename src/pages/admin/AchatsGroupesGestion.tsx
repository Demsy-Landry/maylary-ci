import { useEffect, useMemo, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import {
  supabase,
  ACHATS_GROUPES_TABLE,
  ACHATS_GROUPES_PUBLICS_VIEW,
  PARTICIPATIONS_ACHAT_GROUPE_TABLE,
  PRODUITS_TABLE,
  STATUT_ACHAT_GROUPE_LABELS,
  type AchatGroupePublic,
  type ParticipationAchatGroupe,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, Users, Gavel } from 'lucide-react';
import { toast } from 'sonner';

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

interface ProduitOption {
  id: string;
  nom: string;
  prix_unitaire_fcfa: number;
}

/** Dans quinze jours, à minuit — une valeur de départ raisonnable. */
function echeanceParDefaut(): string {
  const d = new Date(Date.now() + 15 * 86400000);
  d.setHours(23, 59, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Ouvrir et clôturer les achats groupés.
 *
 * La clôture n'est pas un simple changement de statut : au-dessus du seuil,
 * elle crée une commande à régler par réservation, au prix annoncé. C'est la
 * base qui le fait — l'écran ne fait que déclencher et rendre compte, sinon
 * deux clics rapides créeraient deux jeux de commandes.
 */
export default function AdminAchatsGroupesGestion() {
  const [campagnes, setCampagnes] = useState<AchatGroupePublic[]>([]);
  const [produits, setProduits] = useState<ProduitOption[]>([]);
  const [participations, setParticipations] = useState<ParticipationAchatGroupe[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState<AchatGroupePublic | null>(null);
  const [creation, setCreation] = useState(false);

  const [produitId, setProduitId] = useState('');
  const [titre, setTitre] = useState('');
  const [argumentaire, setArgumentaire] = useState('');
  const [prixGroupe, setPrixGroupe] = useState('');
  const [objectif, setObjectif] = useState('10');
  const [maximum, setMaximum] = useState('');
  const [maxParClient, setMaxParClient] = useState('10');
  const [echeance, setEcheance] = useState(echeanceParDefaut());

  const charger = async () => {
    const [cRes, pRes, partRes] = await Promise.all([
      supabase.from(ACHATS_GROUPES_PUBLICS_VIEW).select('*').order('cloture_prevue_le', { ascending: true }),
      supabase
        .from(PRODUITS_TABLE)
        .select('id, nom, prix_unitaire_fcfa')
        .eq('actif', true)
        .order('nom'),
      supabase.from(PARTICIPATIONS_ACHAT_GROUPE_TABLE).select('*'),
    ]);
    setCampagnes((cRes.data as AchatGroupePublic[]) ?? []);
    setProduits((pRes.data as ProduitOption[]) ?? []);
    setParticipations((partRes.data as ParticipationAchatGroupe[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    charger();
  }, []);

  const produitChoisi = useMemo(
    () => produits.find((p) => p.id === produitId) ?? null,
    [produits, produitId],
  );

  const creer = async () => {
    if (!produitChoisi) {
      toast.error('Choisissez un article.');
      return;
    }
    const groupe = Number(prixGroupe);
    if (!Number.isFinite(groupe) || groupe <= 0) {
      toast.error('Prix groupé invalide.');
      return;
    }
    if (groupe >= produitChoisi.prix_unitaire_fcfa) {
      toast.error('Le prix groupé doit être inférieur au prix catalogue, sinon il n’y a pas d’économie.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from(ACHATS_GROUPES_TABLE).insert({
      produit_id: produitChoisi.id,
      titre: titre.trim() || null,
      argumentaire: argumentaire.trim() || null,
      prix_unitaire_groupe_fcfa: Math.round(groupe),
      // Figé à l'ouverture : une retarification du catalogue ne doit pas
      // changer toute seule l'économie promise.
      prix_unitaire_normal_fcfa: produitChoisi.prix_unitaire_fcfa,
      quantite_objectif: Math.max(1, Math.round(Number(objectif) || 1)),
      quantite_maximum: maximum.trim() ? Math.round(Number(maximum)) : null,
      quantite_max_par_client: Math.max(1, Math.round(Number(maxParClient) || 10)),
      cloture_prevue_le: new Date(echeance).toISOString(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Achat groupé ouvert.');
    setCreation(false);
    setProduitId('');
    setTitre('');
    setArgumentaire('');
    setPrixGroupe('');
    charger();
  };

  const cloturer = async (campagne: AchatGroupePublic, forcer: boolean) => {
    setBusy(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_cloturer_achat_groupe', {
      p_campagne: campagne.id,
      p_forcer_reussite: forcer,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(String(data));
    setOuvert(null);
    charger();
  };

  const annuler = async (campagne: AchatGroupePublic) => {
    setBusy(true);
    const { error } = await supabase
      .from(ACHATS_GROUPES_TABLE)
      .update({ statut: 'annulee', cloturee_le: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', campagne.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Achat groupé annulé.');
    setOuvert(null);
    charger();
  };

  const participantsDe = (campagneId: string) =>
    participations.filter((p) => p.campagne_id === campagneId && p.statut !== 'abandonnee');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-screen-xl space-y-2 px-4 py-4 sm:px-6">
          <AdminNav />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-lg font-bold text-foreground">Achats groupés</h1>
              <p className="text-sm text-muted-foreground">
                Un prix ferme, un seuil, une date limite. Les clients réservent sans payer ; à la
                clôture au-dessus du seuil, chaque réservation devient une commande à régler.
              </p>
            </div>
            <Button onClick={() => setCreation(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Ouvrir un achat groupé
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : campagnes.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucun achat groupé pour l’instant.
          </p>
        ) : (
          <div className="cascade divide-y rounded-md border">
            {campagnes.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{c.titre}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.reference_publique} · {fcfa(c.prix_unitaire_groupe_fcfa)} au lieu de{' '}
                    {fcfa(c.prix_unitaire_normal_fcfa)} · {c.quantite_reservee}/{c.quantite_objectif}{' '}
                    unités · {c.participants} acheteur{c.participants > 1 ? 's' : ''} · limite{' '}
                    {new Date(c.cloture_prevue_le).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={c.statut === 'ouverte' ? 'default' : 'secondary'}>
                    {STATUT_ACHAT_GROUPE_LABELS[c.statut]}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => setOuvert(c)}>
                    <Users className="mr-1.5 h-4 w-4" />
                    Détail
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ---- Création ---- */}
      <Dialog open={creation} onOpenChange={(o) => !o && setCreation(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ouvrir un achat groupé</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="produit">Article</Label>
              <select
                id="produit"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={produitId}
                onChange={(e) => {
                  setProduitId(e.target.value);
                  const p = produits.find((x) => x.id === e.target.value);
                  if (p) setPrixGroupe(String(Math.round(p.prix_unitaire_fcfa * 0.8)));
                }}
              >
                <option value="">Choisir…</option>
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom.slice(0, 70)} — {fcfa(p.prix_unitaire_fcfa)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prix">Prix groupé rendu (FCFA)</Label>
              <Input
                id="prix"
                type="number"
                value={prixGroupe}
                onChange={(e) => setPrixGroupe(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Prix tout compris, livraison incluse : c’est la promesse de l’achat groupé, aucun
                supplément ne s’ajoutera ensuite.
                {produitChoisi &&
                  ` Catalogue actuel : ${fcfa(produitChoisi.prix_unitaire_fcfa)}.`}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="obj">Objectif (unités)</Label>
                <Input id="obj" type="number" min={1} value={objectif} onChange={(e) => setObjectif(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max">Capacité (option)</Label>
                <Input id="max" type="number" value={maximum} onChange={(e) => setMaximum(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mpc">Max / client</Label>
                <Input id="mpc" type="number" min={1} value={maxParClient} onChange={(e) => setMaxParClient(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ech">Date limite</Label>
              <Input id="ech" type="datetime-local" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="titre">Titre affiché (option)</Label>
              <Input id="titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Nom du produit par défaut" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="arg">Argumentaire (option)</Label>
              <Textarea id="arg" rows={2} value={argumentaire} onChange={(e) => setArgumentaire(e.target.value)} />
            </div>

            <Button onClick={creer} disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Ouvrir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Détail et clôture ---- */}
      <Dialog open={!!ouvert} onOpenChange={(o) => !o && setOuvert(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{ouvert?.titre}</DialogTitle>
          </DialogHeader>
          {ouvert && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                <p>
                  {ouvert.reference_publique} · {fcfa(ouvert.prix_unitaire_groupe_fcfa)} au lieu de{' '}
                  {fcfa(ouvert.prix_unitaire_normal_fcfa)}
                </p>
                <p className="mt-1">
                  {ouvert.quantite_reservee} / {ouvert.quantite_objectif} unités réservées ·{' '}
                  {ouvert.participants} acheteur{ouvert.participants > 1 ? 's' : ''}
                </p>
                <p className="mt-1">
                  Encaissement attendu :{' '}
                  <strong className="text-foreground">
                    {fcfa(ouvert.quantite_reservee * ouvert.prix_unitaire_groupe_fcfa)}
                  </strong>
                </p>
              </div>

              <div className="divide-y rounded-md border text-sm">
                {participantsDe(ouvert.id).length === 0 ? (
                  <p className="p-3 text-muted-foreground">Aucune réservation.</p>
                ) : (
                  participantsDe(ouvert.id).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-foreground">{p.nom_destinataire}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.telephone_destinataire} · {p.ville_livraison}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-medium text-foreground">{p.quantite} u.</p>
                        {p.statut === 'commandee' && (
                          <p className="text-xs text-muted-foreground">commande créée</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {ouvert.statut === 'ouverte' && (
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => cloturer(ouvert, false)} disabled={busy}>
                    {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    <Gavel className="mr-1.5 h-4 w-4" />
                    Clôturer
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Au-dessus de l’objectif, chaque réservation devient une commande à régler. En
                    dessous, la campagne est close sans commande et personne n’est débité.
                  </p>
                  {ouvert.quantite_reservee > 0 &&
                    ouvert.quantite_reservee < ouvert.quantite_objectif && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => cloturer(ouvert, true)}
                        disabled={busy}
                      >
                        Honorer le prix malgré le seuil non atteint
                      </Button>
                    )}
                  <Button variant="ghost" className="w-full" onClick={() => annuler(ouvert)} disabled={busy}>
                    Annuler cet achat groupé
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
