import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Package,
  Search,
  Save,
  Trash2,
  EyeOff,
  Eye,
  Loader2,
  Languages,
  FileQuestion,
  Truck,
  ImageOff,
  AlertTriangle,
} from 'lucide-react';

/**
 * L'écran qui manquait complètement.
 *
 * Constat de départ, mesuré : 55 noms d'articles sur 94 étaient en anglais tels
 * que CJ les rend, 94 sur 94 n'avaient AUCUNE description, et il n'existait
 * nulle part un endroit pour corriger ou supprimer quoi que ce soit. Le
 * fondateur : « je ne peux pas supprimer un article ». Ce n'était pas un bouton
 * manquant — l'écran n'existait pas.
 *
 * CE QUI GUIDE SA CONSTRUCTION
 *
 * **Il trie par défaut par ce qui ne va pas.** Un catalogue de cent articles
 * parcouru au hasard n'est jamais corrigé. Trié par nombre de défauts, les
 * pires remontent et le travail a une fin visible.
 *
 * **Les défauts sont nommés, pas comptés.** « 55 fiches à revoir » ne fait
 * travailler personne ; « nom en anglais », « sans description », « fret
 * supérieur au prix » disent quoi faire.
 *
 * **Le prix d'achat et le fret mesuré ne sont pas modifiables.** Ce sont des
 * faits relevés chez le fournisseur, pas des réglages. Ils s'affichent pour
 * que la marge soit lisible pendant qu'on fixe le prix de vente.
 */

const fcfa = (n: number | null) =>
  n === null || n === undefined ? '—' : `${Math.round(n).toLocaleString('fr-FR')} F`;

type Defaut = 'nom_anglais' | 'sans_description' | 'fret_superieur_au_prix' | 'sans_photo';

interface ProduitAdmin {
  id: string;
  nom: string;
  description: string | null;
  photo: string | null;
  espace: string;
  actif: boolean;
  prix_unitaire_fcfa: number;
  prix_achat_fcfa: number | null;
  cout_fret_fcfa: number | null;
  source_donnee: string;
  reference_externe: string | null;
  commandes: number;
  coefficient: number | null;
  defauts: Defaut[];
}

const DEFAUTS: Record<Defaut, { libelle: string; icone: typeof Languages; aide: string }> = {
  nom_anglais: {
    libelle: 'Nom en anglais',
    icone: Languages,
    aide: 'Le client lit le libellé brut du fournisseur.',
  },
  sans_description: {
    libelle: 'Sans description',
    icone: FileQuestion,
    aide: 'Rien n’explique au client ce qu’il achète.',
  },
  fret_superieur_au_prix: {
    libelle: 'Fret > prix',
    icone: Truck,
    aide: 'Le transport coûte plus cher que l’article : à vendre en groupage.',
  },
  sans_photo: { libelle: 'Sans photo', icone: ImageOff, aide: 'Une fiche sans image ne se vend pas.' },
};

export default function ProduitsGestion() {
  const [produits, setProduits] = useState<ProduitAdmin[] | null>(null);
  const [filtre, setFiltre] = useState('');
  const [defautFiltre, setDefautFiltre] = useState<Defaut | null>(null);
  const [edite, setEdite] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState({ nom: '', description: '', prix: '' });
  const [travail, setTravail] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('app_e08c374bc4_produits_a_corriger');
    if (error) {
      toast.error(error.message);
      return;
    }
    setProduits(data as ProduitAdmin[]);
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const ouvrir = (p: ProduitAdmin) => {
    setEdite(p.id);
    setBrouillon({
      nom: p.nom,
      description: p.description ?? '',
      prix: String(Math.round(p.prix_unitaire_fcfa)),
    });
  };

  const enregistrer = async (p: ProduitAdmin) => {
    setTravail(p.id);
    const { error } = await supabase.rpc('app_e08c374bc4_corriger_produit', {
      p_id: p.id,
      p_nom: brouillon.nom,
      p_description: brouillon.description,
      p_prix_unitaire_fcfa: Number(brouillon.prix) || null,
    });
    setTravail(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Article corrigé.');
    setEdite(null);
    void charger();
  };

  const basculerActif = async (p: ProduitAdmin) => {
    setTravail(p.id);
    const { error } = await supabase.rpc('app_e08c374bc4_corriger_produit', {
      p_id: p.id,
      p_actif: !p.actif,
    });
    setTravail(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(p.actif ? 'Article retiré de la vente.' : 'Article remis en vente.');
    void charger();
  };

  const supprimer = async (p: ProduitAdmin) => {
    // Le compte des commandes est affiché sur la carte : la confirmation ne
    // révèle donc rien de nouveau, elle empêche seulement le clic malheureux.
    if (!window.confirm(`Supprimer « ${p.nom.slice(0, 60)} » ?`)) return;
    setTravail(p.id);
    const { data, error } = await supabase.rpc('app_e08c374bc4_supprimer_produit', { p_id: p.id });
    setTravail(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success((data as { message: string }).message);
    void charger();
  };

  const cherche = filtre.trim().toLowerCase();
  const vus = useMemo(
    () =>
      (produits ?? [])
        .filter((p) => !cherche || p.nom.toLowerCase().includes(cherche))
        .filter((p) => !defautFiltre || p.defauts.includes(defautFiltre))
        // Les plus abîmés d'abord : le travail a une fin visible.
        .sort((a, b) => b.defauts.length - a.defauts.length),
    [produits, cherche, defautFiltre],
  );

  const compte = (d: Defaut) => (produits ?? []).filter((p) => p.defauts.includes(d)).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:px-6">
          <AdminNav />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="trait-anime flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Package className="h-5 w-5 text-primary" />
              Admin — Articles du catalogue
            </h1>
            {produits && (
              <span className="text-sm text-muted-foreground">
                {produits.length} article{produits.length > 1 ? 's' : ''} ·{' '}
                {produits.filter((p) => p.defauts.length > 0).length} à revoir
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="entree-page mx-auto max-w-screen-xl space-y-5 px-4 py-6 sm:px-6">
        {/* Les défauts en tête, cliquables : c'est la liste de travail. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              placeholder="Chercher un article"
              className="pl-8"
            />
          </div>
          {(Object.keys(DEFAUTS) as Defaut[]).map((d) => {
            const Icone = DEFAUTS[d].icone;
            const n = compte(d);
            return (
              <Button
                key={d}
                size="sm"
                variant={defautFiltre === d ? 'default' : 'outline'}
                className="bouton-anime"
                onClick={() => setDefautFiltre(defautFiltre === d ? null : d)}
                title={DEFAUTS[d].aide}
              >
                <Icone className="mr-1.5 h-3.5 w-3.5" />
                {DEFAUTS[d].libelle}
                <Badge variant="secondary" className="ml-1.5 tabular-nums">
                  {n}
                </Badge>
              </Button>
            );
          })}
        </div>

        {produits === null ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : vus.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Aucun article ne correspond.
          </p>
        ) : (
          <ul className="space-y-3">
            {vus.map((p) => (
              <li key={p.id} className="carte-reactive rounded-xl border bg-card">
                <div className="flex flex-wrap items-start gap-4 p-4">
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-muted">
                      <ImageOff className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">{p.nom}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {!p.actif && <Badge variant="outline">Retiré de la vente</Badge>}
                      <Badge variant="secondary">{p.espace === 'pro' ? 'Espace Pro' : 'Boutique'}</Badge>
                      {p.commandes > 0 && (
                        <Badge variant="outline" className="tabular-nums">
                          {p.commandes} commande{p.commandes > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {p.defauts.map((d) => {
                        const Icone = DEFAUTS[d].icone;
                        return (
                          <Badge
                            key={d}
                            variant="outline"
                            className="gap-1 border-amber-500/50 text-amber-700"
                            title={DEFAUTS[d].aide}
                          >
                            <Icone className="h-3 w-3" />
                            {DEFAUTS[d].libelle}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* Les chiffres, pour que la marge soit lisible pendant
                      qu'on fixe le prix. Achat et fret sont des faits mesurés :
                      ils s'affichent, ils ne se modifient pas. */}
                  <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    <p>
                      Achat <span className="text-foreground">{fcfa(p.prix_achat_fcfa)}</span>
                    </p>
                    <p>
                      Fret <span className="text-foreground">{fcfa(p.cout_fret_fcfa)}</span>
                    </p>
                    <p className="mt-1 font-display text-sm font-bold text-foreground">
                      {fcfa(p.prix_unitaire_fcfa)}
                      {p.coefficient !== null && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ×{p.coefficient}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => (edite === p.id ? setEdite(null) : ouvrir(p))}>
                      Corriger
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void basculerActif(p)}
                      disabled={travail === p.id}
                      title={p.actif ? 'Retirer de la vente' : 'Remettre en vente'}
                    >
                      {p.actif ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/5"
                      onClick={() => void supprimer(p)}
                      disabled={travail === p.id}
                      title="Supprimer"
                    >
                      {travail === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {edite === p.id && (
                  <div className="rideau space-y-3 border-t p-4">
                    <div>
                      <Label htmlFor={`nom-${p.id}`} className="text-xs">
                        Nom vu par le client
                      </Label>
                      <Input
                        id={`nom-${p.id}`}
                        value={brouillon.nom}
                        onChange={(e) => setBrouillon((b) => ({ ...b, nom: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`desc-${p.id}`} className="text-xs">
                        Description — dites ce que c’est, en quoi c’est fait, à quoi ça sert
                      </Label>
                      <Textarea
                        id={`desc-${p.id}`}
                        rows={3}
                        value={brouillon.description}
                        onChange={(e) => setBrouillon((b) => ({ ...b, description: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <Label htmlFor={`prix-${p.id}`} className="text-xs">
                          Prix de vente (FCFA)
                        </Label>
                        <Input
                          id={`prix-${p.id}`}
                          inputMode="numeric"
                          value={brouillon.prix}
                          onChange={(e) => setBrouillon((b) => ({ ...b, prix: e.target.value }))}
                          className="w-40 tabular-nums"
                        />
                      </div>
                      {p.prix_achat_fcfa ? (
                        <p className="pb-2 text-xs text-muted-foreground">
                          Marge :{' '}
                          <strong className="text-foreground">
                            {fcfa((Number(brouillon.prix) || 0) - p.prix_achat_fcfa)}
                          </strong>{' '}
                          par unité
                        </p>
                      ) : null}
                      <Button
                        size="sm"
                        className="bouton-anime mb-0.5"
                        onClick={() => void enregistrer(p)}
                        disabled={travail === p.id}
                      >
                        {travail === p.id ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-1.5 h-4 w-4" />
                        )}
                        Enregistrer
                      </Button>
                    </div>

                    {p.defauts.includes('fret_superieur_au_prix') && (
                      <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50/40 p-3 text-xs leading-relaxed text-muted-foreground">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span>
                          Le fret ({fcfa(p.cout_fret_fcfa)}) dépasse le prix de vente. En colis
                          express, cet article fera fuir le client. Il est fait pour le groupage :
                          le panier proposera désormais cette voie automatiquement.
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
