import { useEffect, useMemo, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import NoteEtoiles from '@/components/NoteEtoiles';
import {
  supabase,
  QUALITE_FOURNISSEURS_VIEW,
  INCIDENTS_FOURNISSEUR_TABLE,
  PRODUITS_TABLE,
  AVIS_ARTICLES_TABLE,
  TYPE_INCIDENT_LABELS,
  type QualiteFournisseur,
  type IncidentFournisseur,
  type TypeIncidentFournisseur,
  type AvisArticle,
} from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, ShieldCheck, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface ArticleAtelier {
  id: string;
  nom: string;
  actif: boolean;
  marchands_vendeurs: number | null;
}

/**
 * Ce que valent nos ateliers, mesuré sur nos propres commandes.
 *
 * CJ ne publie ni note, ni avis, ni volume de ventes : aucun signal de
 * fiabilité ne vient du fournisseur. Cet écran ne montre donc que ce que nous
 * avons nous-mêmes constaté — ce que le client a dit après livraison, et ce que
 * nous avons vu passer en incident.
 *
 * Un atelier sans livraison apparaît quand même, à zéro. Une fiche vide n'est
 * pas un bon fournisseur : c'est un fournisseur qu'on ne connaît pas encore, et
 * la distinction doit rester visible avant de lui confier une commande.
 */
export default function QualiteFournisseurs() {
  const { user } = useAuth();

  const [fiches, setFiches] = useState<QualiteFournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState('');

  const [detail, setDetail] = useState<QualiteFournisseur | null>(null);
  const [articles, setArticles] = useState<ArticleAtelier[]>([]);
  const [incidents, setIncidents] = useState<IncidentFournisseur[]>([]);
  const [avis, setAvis] = useState<(AvisArticle & { nom_produit?: string })[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [saisie, setSaisie] = useState<{
    type: TypeIncidentFournisseur;
    produit_id: string;
    description: string;
    cout: string;
  }>({ type: 'article_defectueux', produit_id: '', description: '', cout: '0' });
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = async () => {
    setLoading(true);
    const { data } = await supabase
      .from(QUALITE_FOURNISSEURS_VIEW)
      .select('*')
      .order('nb_incidents', { ascending: false });
    setFiches((data as QualiteFournisseur[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    charger();
  }, []);

  const ouvrir = async (fiche: QualiteFournisseur) => {
    setDetail(fiche);
    setDetailLoading(true);
    setSaisie({ type: 'article_defectueux', produit_id: '', description: '', cout: '0' });

    const { data: articlesData } = await supabase
      .from(PRODUITS_TABLE)
      .select('id, nom, actif, marchands_vendeurs')
      .eq('fournisseur_origine_id', fiche.fournisseur_origine_id)
      .order('nom');
    const liste = (articlesData as ArticleAtelier[]) ?? [];
    setArticles(liste);

    const [incidentsRes, avisRes] = await Promise.all([
      supabase
        .from(INCIDENTS_FOURNISSEUR_TABLE)
        .select('*')
        .eq('fournisseur_origine_id', fiche.fournisseur_origine_id)
        .order('created_at', { ascending: false }),
      liste.length > 0
        ? supabase
            .from(AVIS_ARTICLES_TABLE)
            .select('*')
            .in(
              'produit_id',
              liste.map((a) => a.id),
            )
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as AvisArticle[] }),
    ]);

    setIncidents((incidentsRes.data as IncidentFournisseur[]) ?? []);
    const nomParId = new Map(liste.map((a) => [a.id, a.nom]));
    setAvis(
      ((avisRes.data as AvisArticle[]) ?? []).map((a) => ({
        ...a,
        nom_produit: nomParId.get(a.produit_id),
      })),
    );
    setDetailLoading(false);
  };

  const enregistrerIncident = async () => {
    if (!detail) return;
    if (!saisie.description.trim()) {
      toast.info("Décrivez ce qui s'est passé : c'est ce qui rendra l'incident lisible plus tard.");
      return;
    }

    setEnregistrement(true);
    const { error } = await supabase.from(INCIDENTS_FOURNISSEUR_TABLE).insert({
      produit_id: saisie.produit_id || null,
      // Le nom est recopié à la constatation : l'incident doit survivre au
      // retrait de l'article, sinon l'historique d'un atelier s'efface avec lui.
      fournisseur_origine_id: detail.fournisseur_origine_id,
      fournisseur_origine: detail.fournisseur,
      type_incident: saisie.type,
      description: saisie.description.trim(),
      cout_fcfa: Number(saisie.cout) || 0,
      constate_par: user?.id ?? null,
    });
    setEnregistrement(false);

    if (error) {
      toast.error("L'incident n'a pas pu être enregistré.");
      return;
    }
    toast.success('Incident consigné.');
    setSaisie({ type: 'article_defectueux', produit_id: '', description: '', cout: '0' });
    await ouvrir(detail);
    await charger();
  };

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return fiches;
    return fiches.filter((f) => (f.fournisseur ?? '').toLowerCase().includes(q));
  }, [fiches, recherche]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6">
        <AdminNav />

        <h1 className="mt-6 text-2xl font-bold text-foreground">Qualité des fournisseurs</h1>
        <p className="text-sm text-muted-foreground">
          Construite sur nos commandes : ce que le client a dit après livraison, et ce que nous
          avons constaté nous-mêmes.
        </p>

        {/* Le lecteur doit savoir ce qu'il ne voit pas. Un atelier sans
            livraison n'a pas de taux d'incident — pas un taux de zéro. */}
        <p className="mt-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Une fiche vide n'est pas un bon fournisseur, c'est un fournisseur que nous ne connaissons
          pas encore. Le taux d'incident reste vide tant qu'aucune pièce n'a été livrée.
        </p>

        <div className="mt-4">
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un atelier..."
            className="max-w-sm"
          />
        </div>

        {loading ? (
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed p-10 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun atelier identifié pour l'instant. Le fournisseur d'un article est relevé chez CJ
              depuis l'écran Catalogue CJ Dropshipping.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-muted/50 text-left text-xs font-medium text-foreground">
                <tr>
                  <th className="px-3 py-2">Atelier</th>
                  <th className="px-3 py-2 text-right">Articles</th>
                  <th className="px-3 py-2 text-right">Marchands</th>
                  <th className="px-3 py-2 text-right">Pièces livrées</th>
                  <th className="px-3 py-2">Note client</th>
                  <th className="px-3 py-2 text-right">Incidents</th>
                  <th className="px-3 py-2 text-right">Taux</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibles.map((f) => (
                  <tr key={f.fournisseur_origine_id}>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {f.fournisseur ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">{f.articles_actifs}</td>
                    <td className="px-3 py-2 text-right">
                      {/* Le nombre de marchands qui revendent la référence chez CJ
                          est le seul indice antérieur à notre première commande. */}
                      {f.marchands_max ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">{f.pieces_livrees}</td>
                    <td className="px-3 py-2">
                      {f.note_moyenne == null ? (
                        <span className="text-xs text-muted-foreground">Pas encore d'avis</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <NoteEtoiles note={Number(f.note_moyenne)} taille={13} />
                          <span className="text-xs text-muted-foreground">
                            {Number(f.note_moyenne).toFixed(1)} · {f.nb_avis}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {f.nb_incidents > 0 ? (
                        <Badge variant="destructive">{f.nb_incidents}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {f.taux_incident_pct == null ? (
                        <span className="text-xs text-muted-foreground">non mesuré</span>
                      ) : (
                        `${Number(f.taux_incident_pct).toFixed(1)} %`
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => ouvrir(f)}>
                        Ouvrir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail?.fournisseur ?? 'Atelier'}</DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Articles actifs', valeur: String(detail.articles_actifs) },
                  { label: 'Pièces livrées', valeur: String(detail.pieces_livrees) },
                  {
                    label: 'Note client',
                    valeur:
                      detail.note_moyenne == null
                        ? '—'
                        : `${Number(detail.note_moyenne).toFixed(1)} / 5`,
                  },
                  {
                    label: 'Coût des incidents',
                    valeur: `${Number(detail.cout_incidents_fcfa).toLocaleString('fr-FR')} FCFA`,
                  },
                ].map((c) => (
                  <div key={c.label} className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="text-sm font-semibold text-foreground">{c.valeur}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MessageSquare className="h-4 w-4" />
                  Avis clients ({avis.length})
                </p>
                {avis.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aucun avis pour l'instant — aucune commande de cet atelier n'a encore été livrée
                    et notée.
                  </p>
                ) : (
                  <div className="mt-2 divide-y rounded-md border">
                    {avis.map((a) => (
                      <div key={a.id} className="p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <NoteEtoiles note={a.note} taille={13} />
                          <span className="text-xs text-muted-foreground">
                            {a.nom_produit ?? 'Article retiré'} ·{' '}
                            {new Date(a.created_at).toLocaleDateString('fr-FR')}
                          </span>
                          {!a.publie && (
                            <Badge variant="outline" className="text-xs">
                              retiré
                            </Badge>
                          )}
                        </div>
                        {a.commentaire && (
                          <p className="mt-1 text-muted-foreground">{a.commentaire}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Incidents constatés ({incidents.length})
                </p>
                {incidents.length > 0 && (
                  <div className="mt-2 divide-y rounded-md border">
                    {incidents.map((i) => (
                      <div key={i.id} className="p-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {TYPE_INCIDENT_LABELS[i.type_incident] ?? i.type_incident}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(i.created_at).toLocaleDateString('fr-FR')}
                          </span>
                          {Number(i.cout_fcfa) > 0 && (
                            <span className="text-xs font-medium text-destructive">
                              {Number(i.cout_fcfa).toLocaleString('fr-FR')} FCFA
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-muted-foreground">{i.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Un article cassé remplacé avant expédition ne produira jamais de
                  mauvais avis : le client ne l'a pas vu. Il coûte pourtant, et
                  il dit quelque chose de l'atelier. C'est ici qu'il s'inscrit. */}
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium text-foreground">Consigner un incident</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="type-incident">Nature</Label>
                    <select
                      id="type-incident"
                      value={saisie.type}
                      onChange={(e) =>
                        setSaisie((s) => ({
                          ...s,
                          type: e.target.value as TypeIncidentFournisseur,
                        }))
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Object.entries(TYPE_INCIDENT_LABELS).map(([valeur, libelle]) => (
                        <option key={valeur} value={valeur}>
                          {libelle}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="article-incident">Article concerné (optionnel)</Label>
                    <select
                      id="article-incident"
                      value={saisie.produit_id}
                      onChange={(e) => setSaisie((s) => ({ ...s, produit_id: e.target.value }))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Tout l'atelier</option>
                      {articles.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description-incident">Ce qui s'est passé</Label>
                  <Textarea
                    id="description-incident"
                    value={saisie.description}
                    onChange={(e) => setSaisie((s) => ({ ...s, description: e.target.value }))}
                    rows={2}
                    placeholder="ex: 2 pièces sur 10 arrivées avec la coque fendue, remplacées avant expédition"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cout-incident">Ce qu'il nous a coûté (FCFA)</Label>
                  <Input
                    id="cout-incident"
                    type="number"
                    min={0}
                    value={saisie.cout}
                    onChange={(e) => setSaisie((s) => ({ ...s, cout: e.target.value }))}
                    className="max-w-xs"
                  />
                </div>

                <Button onClick={enregistrerIncident} disabled={enregistrement}>
                  {enregistrement && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Consigner
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
