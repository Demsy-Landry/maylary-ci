import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AdminNav from '@/components/AdminNav';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  DEMANDES_SOURCING_TABLE,
  STATUT_SOURCING_LABELS,
  type CandidatSourcing,
  type DemandeSourcing,
  type StatutSourcing,
} from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Search, Send, Ban, ExternalLink } from 'lucide-react';

const BADGE_VARIANT: Record<StatutSourcing, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  nouvelle: 'default',
  transmise: 'secondary',
  cotee: 'outline',
  devis_envoye: 'default',
  acceptee: 'default',
  refusee: 'destructive',
  abandonnee: 'destructive',
};

/** Statuts qui appellent une action de notre part. */
const A_TRAITER: StatutSourcing[] = ['nouvelle', 'transmise', 'cotee'];

export default function AdminSourcingGestion() {
  const [demandes, setDemandes] = useState<DemandeSourcing[]>([]);
  const [loading, setLoading] = useState(true);
  const [ouverte, setOuverte] = useState<DemandeSourcing | null>(null);

  const [motCle, setMotCle] = useState('');
  const [recherche, setRecherche] = useState(false);
  const [candidats, setCandidats] = useState<CandidatSourcing[] | null>(null);
  const [motCleTraduit, setMotCleTraduit] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<CandidatSourcing | null>(null);

  const [prixPropose, setPrixPropose] = useState('');
  const [delaiJours, setDelaiJours] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = async () => {
    setLoading(true);
    const { data } = await supabase
      .from(DEMANDES_SOURCING_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    setDemandes((data as DemandeSourcing[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    charger();
  }, []);

  const appeler = async (corps: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expirée, reconnectez-vous.');
    const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_sourcing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(corps),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? 'Une erreur est survenue.');
    return json;
  };

  const ouvrir = (d: DemandeSourcing) => {
    setOuverte(d);
    setMotCle(d.designation);
    setCandidats(null);
    setMotCleTraduit(null);
    setChoisi(null);
    setPrixPropose(d.prix_propose_fcfa != null ? String(d.prix_propose_fcfa) : '');
    setDelaiJours(d.delai_source_jours != null ? String(d.delai_source_jours) : '');
    setCommentaire(d.commentaire_admin ?? '');
  };

  const chercher = async () => {
    if (!ouverte) return;
    setRecherche(true);
    setCandidats(null);
    try {
      const json = await appeler({
        action: 'chercher',
        demande_id: ouverte.id,
        mot_cle: motCle.trim() || undefined,
      });
      setCandidats((json.candidats as CandidatSourcing[]) ?? []);
      setMotCleTraduit(json.mot_cle_traduit ?? null);
      if (!json.candidats?.length) {
        toast.info('Aucune correspondance chiffrable chez le fournisseur.');
      }
      charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recherche impossible.');
    } finally {
      setRecherche(false);
    }
  };

  const retenir = (c: CandidatSourcing) => {
    setChoisi(c);
    // Le prix proposé part du prix calculé au coût réel : l'admin peut le
    // réduire en connaissance de cause, jamais par inadvertance.
    setPrixPropose(String(c.prix_unitaire_fcfa));
  };

  const envoyerDevis = async () => {
    if (!ouverte) return;
    const prix = Number(prixPropose);
    if (!Number.isFinite(prix) || prix <= 0) {
      toast.error('Indiquez un prix valide.');
      return;
    }
    setBusy(true);
    try {
      await appeler({
        action: 'devis',
        demande_id: ouverte.id,
        prix_propose_fcfa: prix,
        prix_source_usd: choisi?.prix_source_usd,
        delai_source_jours: delaiJours ? Number(delaiJours) : undefined,
        reference_externe: choisi?.reference_externe,
        commentaire: commentaire.trim() || undefined,
      });
      toast.success('Prix transmis au client.');
      setOuverte(null);
      charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  const refuser = async () => {
    if (!ouverte) return;
    if (!commentaire.trim()) {
      toast.error('Un motif est requis : le client doit savoir pourquoi.');
      return;
    }
    setBusy(true);
    try {
      await appeler({ action: 'refuser', demande_id: ouverte.id, commentaire: commentaire.trim() });
      toast.success('Demande close, motif transmis.');
      setOuverte(null);
      charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  const aTraiter = demandes.filter((d) => A_TRAITER.includes(d.statut));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">
              Admin — Sourcing sur demande
            </h1>
          </div>
          {aTraiter.length > 0 && (
            <Badge variant="outline" className="border-primary text-primary-emphasis">
              {aTraiter.length} à traiter
            </Badge>
          )}
        </div>
      </header>

      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : demandes.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucune demande de sourcing pour le moment.
          </p>
        ) : (
          <div className="cascade divide-y rounded-md border">
            {demandes.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{d.designation}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.reference_publique} · {d.quantite_souhaitee} pièce
                    {d.quantite_souhaitee > 1 ? 's' : ''}
                    {d.prix_cible_fcfa
                      ? ` · cible ${d.prix_cible_fcfa.toLocaleString('fr-FR')} FCFA`
                      : ''}{' '}
                    · {new Date(d.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={BADGE_VARIANT[d.statut]}>{STATUT_SOURCING_LABELS[d.statut]}</Badge>
                  <Button variant="outline" size="sm" onClick={() => ouvrir(d)}>
                    <Search className="mr-1.5 h-4 w-4" />
                    Traiter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!ouverte} onOpenChange={(open) => !open && setOuverte(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{ouverte?.reference_publique}</DialogTitle>
          </DialogHeader>
          {ouverte && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium text-foreground">{ouverte.designation}</p>
                <p className="mt-1 text-muted-foreground">
                  {ouverte.quantite_souhaitee} pièce{ouverte.quantite_souhaitee > 1 ? 's' : ''}
                  {ouverte.prix_cible_fcfa
                    ? ` · prix cible ${ouverte.prix_cible_fcfa.toLocaleString('fr-FR')} FCFA/pièce`
                    : ' · pas de prix cible'}
                </p>
                {ouverte.precisions && (
                  <p className="mt-1 text-muted-foreground">{ouverte.precisions}</p>
                )}
                {ouverte.lien_reference && (
                  <a
                    href={ouverte.lien_reference}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline"
                  >
                    Lien fourni par le client
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="motcle">Mot-clé de recherche</Label>
                <div className="flex gap-2">
                  <Input id="motcle" value={motCle} onChange={(e) => setMotCle(e.target.value)} />
                  <Button onClick={chercher} disabled={recherche}>
                    {recherche ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-1.5 h-4 w-4" />
                    )}
                    Chercher
                  </Button>
                </div>
                {motCleTraduit && (
                  <p className="text-xs text-muted-foreground">
                    Interrogé en anglais : « {motCleTraduit} »
                  </p>
                )}
                {recherche && (
                  <p className="text-xs text-muted-foreground">
                    Le fournisseur limite à un appel par seconde — comptez une dizaine de secondes.
                  </p>
                )}
              </div>

              {candidats && candidats.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Chiffré pour {ouverte.quantite_souhaitee} pièce
                    {ouverte.quantite_souhaitee > 1 ? 's' : ''}, transport et assurance compris
                  </p>
                  {candidats.map((c) => (
                    <button
                      key={c.reference_externe}
                      type="button"
                      onClick={() => retenir(c)}
                      className={`bouton-anime flex w-full gap-3 rounded-md border p-2 text-left transition-colors ${
                        choisi?.reference_externe === c.reference_externe
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      {c.photo && (
                        <img
                          src={c.photo}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{c.nom}</p>
                        <p className="text-xs text-muted-foreground">
                          Achat {c.prix_source_usd.toFixed(2)} $ · fret{' '}
                          {c.cout_fret_unitaire_fcfa.toLocaleString('fr-FR')} · assurance{' '}
                          {c.cout_assurance_unitaire_fcfa.toLocaleString('fr-FR')} · revient{' '}
                          {c.cout_revient_unitaire_fcfa.toLocaleString('fr-FR')} FCFA
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.fret_transporteur ?? 'transporteur inconnu'}
                          {c.fret_delai ? ` · ${c.fret_delai}` : ''}
                          {c.fret_source === 'forfait' ? ' · fret estimé, non coté' : ''}
                          {c.stock_disponible != null ? ` · stock ${c.stock_disponible}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-foreground">
                          {c.prix_unitaire_fcfa.toLocaleString('fr-FR')}
                        </p>
                        <p className="text-xs text-muted-foreground">FCFA/pièce</p>
                        {c.dans_le_budget === true && (
                          <Badge variant="default" className="mt-1">
                            dans le budget
                          </Badge>
                        )}
                        {c.dans_le_budget === false && (
                          <Badge variant="outline" className="mt-1">
                            au-dessus
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {candidats && candidats.length === 0 && (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Rien de chiffrable pour ce mot-clé. Essayez une autre formulation, ou refusez la
                  demande en expliquant pourquoi.
                </p>
              )}

              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="prix">Prix annoncé au client (FCFA/pièce)</Label>
                    <Input
                      id="prix"
                      type="number"
                      value={prixPropose}
                      onChange={(e) => setPrixPropose(e.target.value)}
                    />
                    {choisi && Number(prixPropose) < choisi.cout_revient_unitaire_fcfa && (
                      <p className="text-xs text-destructive">
                        Sous le coût de revient ({choisi.cout_revient_unitaire_fcfa.toLocaleString('fr-FR')}{' '}
                        FCFA) : cette vente perdrait de l'argent.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="delai">Délai annoncé (jours)</Label>
                    <Input
                      id="delai"
                      type="number"
                      value={delaiJours}
                      onChange={(e) => setDelaiJours(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="commentaire">Message au client</Label>
                  <Textarea
                    id="commentaire"
                    rows={2}
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    placeholder="ex : modèle équivalent, coloris noir uniquement"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={envoyerDevis} disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-4 w-4" />
                    )}
                    Transmettre le prix
                  </Button>
                  <Button variant="outline" onClick={refuser} disabled={busy}>
                    <Ban className="mr-1.5 h-4 w-4" />
                    Article introuvable
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
