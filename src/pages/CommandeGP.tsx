import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { useCartGP, prixLigne } from '@/hooks/useCartGP';
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
  EDGE_FUNCTIONS_URL,
  type OptionTransport,
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
import { Loader2, Landmark, Smartphone, ShoppingCart, Truck, TriangleAlert } from 'lucide-react';

export default function CommandeGP() {
  const { items, totalFcfa, clearCart } = useCartGP();
  /**
   * Remise de groupage : la part fixe de transport que les prix article
   * facturent une fois chacun, alors que le panier ne part qu'en un seul colis.
   * Cotée chez le fournisseur, calculée côté serveur, annoncée avant paiement.
   */
  const [remiseGroupage, setRemiseGroupage] = useState<{
    remise_fcfa: number;
    fret_facture_articles_fcfa?: number;
    fret_reel_panier_fcfa?: number;
    expediable?: boolean;
    motif?: string;
    articles_en_cause?: string[];
    options?: OptionTransport[];
  } | null>(null);
  const [remiseEnCours, setRemiseEnCours] = useState(false);
  /**
   * Transporteur retenu par le client.
   *
   * Le transport économique est déjà compris dans les prix affichés : choisir
   * plus rapide ajoute un supplément, ça ne refait jamais le prix. Le montant
   * annoncé ici est celui qui sera encaissé.
   */
  const [transporteurChoisi, setTransporteurChoisi] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // La remise est cotée dès l'arrivée sur le tunnel, pour que le client la voie
  // avant de choisir son mode de paiement — jamais découverte après coup.
  useEffect(() => {
    if (!user || items.length === 0) return;
    let annule = false;
    const coter = async () => {
      setRemiseEnCours(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_fret_panier`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            lignes: items.map((i) => ({ produit_id: i.produit_id, quantite: i.quantite })),
          }),
        });
        const json = await res.json().catch(() => null);
        if (!annule && res.ok && json?.success) {
          setRemiseGroupage(json);
          // L'option économique est présélectionnée : elle est déjà comprise
          // dans les prix, donc c'est le choix sans surprise.
          const eco = (json.options as OptionTransport[] | undefined)?.find((o) => o.economique);
          setTransporteurChoisi(eco?.transporteur ?? null);
        }
      } catch {
        // Sans cotation, le client paie le prix annoncé : aucune surprise.
      } finally {
        if (!annule) setRemiseEnCours(false);
      }
    };
    coter();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, items.length]);

  const remise = remiseGroupage?.remise_fcfa ?? 0;
  const optionsTransport = remiseGroupage?.options ?? [];
  const optionRetenue = optionsTransport.find((o) => o.transporteur === transporteurChoisi) ?? null;
  const supplementTransport = optionRetenue?.supplement_fcfa ?? 0;
  const totalAPayer = Math.max(0, totalFcfa - remise) + supplementTransport;

  // Un panier qu'aucun transporteur n'accepte ne doit pas être payé : on le
  // dirait après coup, et il faudrait revenir sur un prix encaissé.
  const panierBloque = remiseGroupage?.expediable === false;

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
    if (panierBloque) {
      setFormError(
        "Ce panier ne peut pas être expédié en l'état. Retirez l'article signalé et commandez-le séparément.",
      );
      return;
    }
    if (!nomDestinataire.trim() || !telephoneDestinataire.trim() || !adresseLivraison.trim() || !villeLivraison.trim()) {
      setFormError('Merci de remplir tous les champs de livraison obligatoires.');
      return;
    }

    setSubmitting(true);

    // Contrôle de disponibilité juste avant d'engager la commande. C'est le
    // moment où une rupture coûte le plus cher : encaisser puis rembourser
    // détruit une confiance qu'on met des mois à bâtir. Une disponibilité
    // qu'on n'a pas pu joindre laisse passer — on ne bloque pas une vente
    // parce que le fournisseur n'a pas répondu.
    try {
      const { data: session } = await supabase.auth.getSession();
      const jeton = session.session?.access_token;
      if (jeton) {
        const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_cj_stock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
          body: JSON.stringify({
            action: 'verifier',
            lignes: items.map((i) => ({ produit_id: i.produit_id, quantite: i.quantite })),
          }),
        });
        const controle = await res.json().catch(() => null);
        if (res.ok && controle?.tout_disponible === false) {
          const manquants = (controle.lignes as { nom: string; suffisant: boolean; stock_disponible: number | null }[])
            .filter((l) => !l.suffisant)
            .map((l) => `${l.nom} (${l.stock_disponible ?? 0} disponible)`);
          setFormError(
            `Stock insuffisant chez le fournisseur : ${manquants.join(', ')}. ` +
              'Ajustez les quantités avant de valider.',
          );
          setSubmitting(false);
          return;
        }
      }
    } catch {
      // Le contrôle est une protection, pas un péage : son échec ne doit pas
      // empêcher un client de commander.
    }

    const { data: commande, error: commandeError } = await supabase
      .from(COMMANDES_GP_TABLE)
      .insert({
        user_id: user.id,
        montant_total_fcfa: totalAPayer,
        remise_groupage_fcfa: remise,
        fret_facture_articles_fcfa: remiseGroupage?.fret_facture_articles_fcfa ?? null,
        fret_reel_panier_fcfa: remiseGroupage?.fret_reel_panier_fcfa ?? null,
        transporteur_choisi: optionRetenue?.transporteur ?? null,
        supplement_transporteur_fcfa: supplementTransport,
        delai_transporteur: optionRetenue?.delai ?? null,
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
      prix_unitaire_fcfa: prixLigne(i),
      sous_total: prixLigne(i) * i.quantite,
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
                <div className="cascade grid gap-3 sm:grid-cols-2">
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

              {/* Le transport, avant le paiement : le client voit ce que le
                  fournisseur propose réellement et arbitre lui-même entre prix
                  et délai. Sur un même colis, l'écart va du simple au septuple. */}
              {(remiseEnCours || optionsTransport.length > 0 || panierBloque) && (
                <div className="rounded-md border p-4">
                  <h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                    <Truck className="h-4 w-4 text-primary" />
                    Mode de livraison
                  </h2>

                  {panierBloque ? (
                    <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                        <TriangleAlert className="h-4 w-4" />
                        Ces articles ne voyagent pas ensemble
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {remiseGroupage?.motif === 'article_non_expediable'
                          ? "Aucun transporteur n'accepte cet article vers votre pays :"
                          : 'Pris séparément chacun part sans difficulté, mais aucun transporteur ne les accepte dans le même colis :'}
                      </p>
                      <ul className="mt-1.5 space-y-0.5 text-sm text-foreground">
                        {(remiseGroupage?.articles_en_cause ?? []).map((nom) => (
                          <li key={nom}>· {nom}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Retirez-le de votre panier et commandez-le séparément. Nous préférons vous le
                        dire maintenant plutôt qu'après votre paiement.
                      </p>
                    </div>
                  ) : remiseEnCours ? (
                    <div className="mt-2 space-y-2">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  ) : (
                    <>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Tarifs du transporteur pour votre colis. La livraison économique est déjà
                        comprise dans les prix affichés.
                      </p>
                      <RadioGroup
                        value={transporteurChoisi ?? ''}
                        onValueChange={setTransporteurChoisi}
                      >
                        {optionsTransport.map((o) => (
                          <div
                            key={o.transporteur}
                            className="flex items-start gap-2 rounded-md border p-3"
                          >
                            <RadioGroupItem
                              value={o.transporteur}
                              id={`tr-${o.transporteur}`}
                              className="mt-0.5"
                            />
                            <Label
                              htmlFor={`tr-${o.transporteur}`}
                              className="flex flex-1 flex-wrap items-baseline justify-between gap-2 font-normal"
                            >
                              <span>
                                <span className="font-medium text-foreground">{o.transporteur}</span>
                                {o.delai && (
                                  <span className="block text-xs text-muted-foreground">
                                    Livraison estimée sous {o.delai} jours
                                  </span>
                                )}
                              </span>
                              <span
                                className={`shrink-0 text-sm font-semibold ${
                                  o.economique ? 'text-primary' : 'text-foreground'
                                }`}
                              >
                                {o.economique
                                  ? 'Comprise'
                                  : `+ ${o.supplement_fcfa.toLocaleString('fr-FR')} FCFA`}
                              </span>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </>
                  )}
                </div>
              )}

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
                      {(prixLigne(item) * item.quantite).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                ))}
                {(remise > 0 || remiseEnCours) && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-foreground">
                      Groupage de votre commande
                      <span className="block text-xs text-muted-foreground">
                        Vos articles partent dans un seul colis : les frais de transport
                        comptés en double vous sont rendus.
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-primary">
                      {remiseEnCours ? '…' : `− ${remise.toLocaleString('fr-FR')} FCFA`}
                    </span>
                  </div>
                )}
                {supplementTransport > 0 && optionRetenue && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-foreground">
                      Livraison {optionRetenue.transporteur}
                      {optionRetenue.delai && (
                        <span className="block text-xs text-muted-foreground">
                          Sous {optionRetenue.delai} jours au lieu de la livraison économique.
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium text-foreground">
                      + {supplementTransport.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">
                  {totalAPayer.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <Button className="w-full" onClick={handleSubmit} disabled={submitting || panierBloque}>
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
