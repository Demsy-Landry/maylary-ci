import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { useCartGP } from '@/hooks/useCartGP';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  COMMANDES_GP_TABLE,
  LIGNES_COMMANDE_GP_TABLE,
  HISTORIQUE_COMMANDE_GP_TABLE,
  PARAMETRES_PAIEMENT_TABLE,
  MODE_PAIEMENT_LABELS,
  type ParametresPaiement,
  type ModePaiement,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Landmark, Smartphone, ShoppingCart } from 'lucide-react';

export default function CommandeGP() {
  const { items, totalFcfa, clearCart } = useCartGP();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nomDestinataire, setNomDestinataire] = useState('');
  const [telephoneDestinataire, setTelephoneDestinataire] = useState('');
  const [adresseLivraison, setAdresseLivraison] = useState('');
  const [villeLivraison, setVilleLivraison] = useState('');
  const [notesClient, setNotesClient] = useState('');
  const [modePaiement, setModePaiement] = useState<ModePaiement>('mobile_money');
  const [parametresPaiement, setParametresPaiement] = useState<ParametresPaiement | null>(null);
  const [loadingParams, setLoadingParams] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commandeCreee, setCommandeCreee] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoadingParams(true);
      const { data } = await supabase
        .from(PARAMETRES_PAIEMENT_TABLE)
        .select('*')
        .maybeSingle();
      setParametresPaiement((data as ParametresPaiement) ?? null);
      setLoadingParams(false);
    };
    load();
  }, []);

  const handleSubmit = async () => {
    setFormError('');
    if (!user) {
      toast.info('Connectez-vous pour valider votre commande.');
      navigate('/boutique/compte');
      return;
    }
    if (items.length === 0) return;
    if (!nomDestinataire.trim() || !telephoneDestinataire.trim() || !adresseLivraison.trim() || !villeLivraison.trim()) {
      setFormError('Merci de remplir tous les champs de livraison obligatoires.');
      return;
    }

    setSubmitting(true);

    const { data: commande, error: commandeError } = await supabase
      .from(COMMANDES_GP_TABLE)
      .insert({
        user_id: user.id,
        montant_total_fcfa: totalFcfa,
        mode_paiement: modePaiement,
        nom_destinataire: nomDestinataire.trim(),
        telephone_destinataire: telephoneDestinataire.trim(),
        adresse_livraison: adresseLivraison.trim(),
        ville_livraison: villeLivraison.trim(),
        notes_client: notesClient.trim() || null,
      })
      .select('id, reference_publique')
      .single();

    if (commandeError || !commande) {
      setFormError("Impossible d'enregistrer votre commande. Veuillez réessayer.");
      setSubmitting(false);
      return;
    }

    const lignes = items.map((i) => ({
      commande_id: commande.id,
      produit_id: i.produit_id,
      nom_produit: i.nom,
      quantite: i.quantite,
      prix_unitaire_fcfa: i.prix_unitaire_fcfa,
      sous_total: i.prix_unitaire_fcfa * i.quantite,
    }));

    const { error: lignesError } = await supabase.from(LIGNES_COMMANDE_GP_TABLE).insert(lignes);
    if (lignesError) {
      toast.error("Votre commande a été créée mais certaines lignes n'ont pas pu être enregistrées.");
    }

    await supabase.from(HISTORIQUE_COMMANDE_GP_TABLE).insert({
      commande_id: commande.id,
      statut: 'en_attente_paiement',
      commentaire_admin: null,
    });

    clearCart();
    setSubmitting(false);
    setCommandeCreee(commande.reference_publique);
  };

  if (commandeCreee) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeaderGP />
        <main className="mx-auto max-w-screen-md px-4 py-16 text-center sm:px-6">
          <div className="rounded-lg border bg-card p-8">
            <h1 className="text-xl font-bold text-foreground">Commande enregistrée !</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Référence : <span className="font-semibold text-foreground">{commandeCreee}</span>
            </p>
            <p className="mt-4 text-sm text-foreground">
              Merci d'effectuer le règlement selon les instructions ci-dessous, puis rendez-vous dans
              « Mes commandes » et cliquez sur « J'ai payé » pour nous en informer. Nous vérifierons
              la réception avant de préparer votre commande.
            </p>
            {parametresPaiement && (
              <div className="mt-6 space-y-4 text-left">
                {parametresPaiement.nom_banque && (
                  <div className="rounded-md border p-4">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <Landmark className="h-4 w-4" /> Virement bancaire
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Banque : {parametresPaiement.nom_banque}<br />
                      Titulaire : {parametresPaiement.titulaire_compte}<br />
                      RIB : {parametresPaiement.numero_compte_rib}
                    </p>
                  </div>
                )}
                {parametresPaiement.mobile_money_numero && (
                  <div className="rounded-md border p-4">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <Smartphone className="h-4 w-4" /> Mobile Money
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Opérateur : {parametresPaiement.mobile_money_operateur}<br />
                      Numéro : {parametresPaiement.mobile_money_numero}<br />
                      Titulaire : {parametresPaiement.mobile_money_titulaire}
                    </p>
                  </div>
                )}
                {parametresPaiement.instructions_complementaires && (
                  <p className="text-sm italic text-muted-foreground">
                    {parametresPaiement.instructions_complementaires}
                  </p>
                )}
              </div>
            )}
            <Button asChild className="mt-6">
              <Link to="/boutique/mes-commandes">Suivre ma commande</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">Valider ma commande</h1>

        {items.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed p-10 text-center">
            <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Votre panier est vide.</p>
            <Button asChild className="mt-4">
              <Link to="/boutique">Voir la boutique</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-md border p-4">
                <h2 className="mb-3 font-semibold text-foreground">Livraison</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="nom-dest">Nom du destinataire *</Label>
                    <Input id="nom-dest" value={nomDestinataire} onChange={(e) => setNomDestinataire(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tel-dest">Téléphone *</Label>
                    <Input id="tel-dest" value={telephoneDestinataire} onChange={(e) => setTelephoneDestinataire(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="adresse">Adresse de livraison *</Label>
                    <Input id="adresse" value={adresseLivraison} onChange={(e) => setAdresseLivraison(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ville">Ville *</Label>
                    <Input id="ville" value={villeLivraison} onChange={(e) => setVilleLivraison(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="notes">Notes (optionnel)</Label>
                  <Textarea
                    id="notes"
                    value={notesClient}
                    onChange={(e) => setNotesClient(e.target.value)}
                    rows={2}
                    placeholder="ex: point de repère, disponibilité..."
                  />
                </div>
              </div>

              <div className="rounded-md border p-4">
                <h2 className="mb-3 font-semibold text-foreground">Mode de paiement</h2>
                {loadingParams ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <RadioGroup value={modePaiement} onValueChange={(v) => setModePaiement(v as ModePaiement)}>
                    <div className="flex items-center space-x-2 rounded-md border p-3">
                      <RadioGroupItem value="mobile_money" id="mp-mm" />
                      <Label htmlFor="mp-mm" className="flex items-center gap-2 font-normal">
                        <Smartphone className="h-4 w-4" /> {MODE_PAIEMENT_LABELS.mobile_money}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md border p-3">
                      <RadioGroupItem value="virement" id="mp-vir" />
                      <Label htmlFor="mp-vir" className="flex items-center gap-2 font-normal">
                        <Landmark className="h-4 w-4" /> {MODE_PAIEMENT_LABELS.virement}
                      </Label>
                    </div>
                  </RadioGroup>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Les instructions de paiement précises s'afficheront après validation de votre commande.
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div className="divide-y text-sm">
                {items.map((item) => (
                  <div key={item.produit_id} className="flex justify-between py-1.5">
                    <span className="text-foreground">{item.nom} × {item.quantite}</span>
                    <span className="font-medium text-foreground">
                      {(item.prix_unitaire_fcfa * item.quantite).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">{totalFcfa.toLocaleString('fr-FR')} FCFA</p>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmer la commande
              </Button>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
