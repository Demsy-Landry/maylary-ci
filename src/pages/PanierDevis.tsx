import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicHeaderPro from '@/components/PublicHeaderPro';
import SiteFooter from '@/components/SiteFooter';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  DEMANDES_DEVIS_TABLE,
  LIGNES_DEVIS_TABLE,
  HISTORIQUE_STATUT_TABLE,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Minus, Plus, Trash2, ClipboardList, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useReferencement } from '@/hooks/useReferencement';
import { PAGES } from '@/lib/referencement-pages';

export default function PanierDevis() {
  useReferencement(PAGES["/catalogue/devis"]);

  const { items, updateQuantite, removeItem, totalFcfa, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [referencePublique, setReferencePublique] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const handleSubmit = async () => {
    setFormError('');
    if (!user) {
      toast.info('Connectez-vous pour envoyer votre demande de devis.');
      navigate('/boutique/compte');
      return;
    }
    if (items.length === 0) return;

    setSubmitting(true);

    const { data: demande, error: demandeError } = await supabase
      .from(DEMANDES_DEVIS_TABLE)
      .insert({
        user_id: user.id,
        montant_total_estime_fcfa: totalFcfa,
        notes_client: notes.trim() || null,
      })
      .select('id, reference_publique')
      .single();

    if (demandeError || !demande) {
      setFormError("Impossible d'enregistrer votre demande. Veuillez réessayer.");
      setSubmitting(false);
      return;
    }

    const lignes = items.map((i) => ({
      demande_devis_id: demande.id,
      produit_id: i.produit_id,
      quantite: i.quantite,
      prix_unitaire_au_moment_demande: i.prix_unitaire_fcfa,
      sous_total: i.prix_unitaire_fcfa * i.quantite,
    }));

    const { error: lignesError } = await supabase.from(LIGNES_DEVIS_TABLE).insert(lignes);
    if (lignesError) {
      toast.error("Votre demande a été créée mais certaines lignes n'ont pas pu être enregistrées.");
    }

    await supabase.from(HISTORIQUE_STATUT_TABLE).insert({
      demande_devis_id: demande.id,
      statut: 'nouvelle',
      commentaire_admin: null,
    });

    // Notifie l'admin (best-effort, ne bloque jamais la confirmation client).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_admin_notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          type: 'devis',
          reference_publique: demande.reference_publique,
          montant_fcfa: totalFcfa,
        }),
      }).catch(() => {});
    }

    clearCart();
    setSubmitting(false);
    setReferencePublique(demande.reference_publique);
  };

  if (referencePublique) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeaderPro />
        <main className="entree-page mx-auto max-w-screen-md px-4 py-16 text-center sm:px-6">
          <div className="rounded-lg border bg-card p-8">
            <h1 className="text-xl font-bold text-foreground">Demande de devis envoyée !</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Référence : <span className="font-semibold text-foreground">{referencePublique}</span>
            </p>
            <p className="mt-4 text-sm text-foreground">
              Notre équipe va étudier votre demande et revenir vers vous avec un devis détaillé.
              Vous pouvez suivre son statut à tout moment depuis "Mes devis".
            </p>
            <Button asChild className="mt-6">
              <Link to="/catalogue/mes-devis">Suivre ma demande</Link>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderPro />
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Ma demande de devis</h1>

        {items.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed p-10 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Votre demande de devis est vide. Parcourez l'Espace Pro pour ajouter des produits.
            </p>
            <Button asChild className="mt-4">
              <Link to="/catalogue">Voir l'Espace Pro</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* `min-w-0` sur l'élément de grille : sans lui, la colonne se
                dimensionne sur le contenu le plus large — ici le nom de produit,
                que `truncate` empêche de se couper — et la page entière défile
                horizontalement sur mobile. */}
            <div className="min-w-0 space-y-3 lg:col-span-2">
              {items.map((item) => (
                <div key={item.produit_id} className="flex items-center gap-3 rounded-md border p-3">
                  <ImageWithFallback
                    src={item.photo}
                    alt={item.nom}
                    className="h-16 w-16 shrink-0 rounded-md border object-cover"
                    fallbackClassName="h-16 w-16 shrink-0 rounded-md border"
                  />
                  <div className="min-w-0 flex-1">
                    {item.enseigne_nom && (
                      <p className="truncate text-xs text-muted-foreground">{item.enseigne_nom}</p>
                    )}
                    <p className="truncate font-medium text-foreground">{item.nom}</p>
                    <p className="text-sm font-semibold text-primary">
                      {item.prix_unitaire_fcfa.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center rounded-md border">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateQuantite(item.produit_id, item.quantite - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-sm">{item.quantite}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateQuantite(item.produit_id, item.quantite + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => removeItem(item.produit_id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              <div className="space-y-1.5 pt-2">
                <Label htmlFor="notes">Notes pour votre demande (optionnel)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="ex: délai souhaité, quantités négociables, livraison sur plusieurs sites..."
                />
              </div>
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Marchandise estimée</p>
                <p className="text-2xl font-bold text-primary">{totalFcfa.toLocaleString('fr-FR')} FCFA</p>
                {/* Même règle qu'en boutique : le prix affiché est celui de la
                    marchandise. Le transport se cote sur l'expédition réelle,
                    et figure comme une ligne à part sur le devis. */}
                <p className="mt-1 text-xs text-muted-foreground">
                  Hors livraison. Le transport est coté séparément sur votre commande complète et
                  chiffré dans le devis que nous vous adressons. Montant indicatif — le devis final
                  peut varier selon les quantités négociées.
                </p>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Envoyer la demande de devis
              </Button>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
