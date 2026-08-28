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
  CANAUX_PAIEMENT_TABLE,
  MODE_PAIEMENT_LABELS,
  type CanalPaiement,
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
import { useReferencement } from '@/hooks/useReferencement';
import {
  Loader2,
  Landmark,
  Smartphone,
  ShoppingCart,
  Truck,
  TriangleAlert,
  Ship,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

export default function CommandeGP() {
  useReferencement({
    titre: "Finaliser la commande",
    description:
      "Coordonnées de livraison et règlement.",
    horsIndex: true,
  });

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
    fret_inclus_dans_prix?: boolean;
  } | null>(null);
  const [remiseEnCours, setRemiseEnCours] = useState(false);
  /**
   * Transporteur retenu par le client.
   *
   * Le transport est coté sur le panier réel chez le fournisseur et facturé en
   * ligne séparée : le client voit ce qu'il paie et pour quel délai. Le montant
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
          // La moins chère est présélectionnée : c'est le choix par défaut
          // raisonnable, le client reste libre de payer pour aller plus vite.
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
  /**
   * Le transport ne fait pas partie des prix affichés : il s'ajoute au total,
   * en entier, une fois le transporteur choisi. `supplement_fcfa` porte déjà
   * cette distinction — il vaut le prix complet quand le fret est séparé, et
   * seulement l'écart avec l'option économique quand il est compris.
   */
  const fretSepare = remiseGroupage?.fret_inclus_dans_prix === false;
  const coutLivraison = optionRetenue?.supplement_fcfa ?? 0;
  const totalAPayer = Math.max(0, totalFcfa - remise) + coutLivraison;

  // Un panier qu'aucun transporteur n'accepte ne doit pas être payé : on le
  // dirait après coup, et il faudrait revenir sur un prix encaissé.
  const panierBloque = remiseGroupage?.expediable === false;

  /* Le chiffrage en groupage reprend les lignes refusées : leur libellé, la
   * quantité voulue et leur valeur marchande. Le client vient de se voir
   * refuser sa commande — lui présenter un formulaire vide serait le perdre
   * une seconde fois. */
  const lignesRefusees = items.filter((i) =>
    (remiseGroupage?.articles_en_cause ?? []).includes(i.nom),
  );
  const lienGroupage = `/import/nouvelle-demande?${new URLSearchParams({
    article: (remiseGroupage?.articles_en_cause ?? []).join(' + '),
    quantite: String(lignesRefusees.reduce((t, i) => t + i.quantite, 0) || 1),
    valeur: String(
      Math.round(lignesRefusees.reduce((t, i) => t + prixLigne(i), 0)) || 0,
    ),
  }).toString()}`;

  const [nomDestinataire, setNomDestinataire] = useState('');
  const [telephoneDestinataire, setTelephoneDestinataire] = useState('');
  const [adresseLivraison, setAdresseLivraison] = useState('');
  const [villeLivraison, setVilleLivraison] = useState('');
  const [notesClient, setNotesClient] = useState('');
  const [modePaiement, setModePaiement] = useState<ModePaiement>('mobile_money');
  const [canaux, setCanaux] = useState<CanalPaiement[]>([]);
  const [loadingParams, setLoadingParams] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commandeCreee, setCommandeCreee] = useState<string | null>(null);
  /**
   * Montant figé à la validation. L'écran de confirmation s'affiche après
   * `clearCart()` : lire le total du panier y renverrait zéro, et le client
   * verrait « Payer 0 FCFA ».
   */
  const [montantAPayer, setMontantAPayer] = useState(0);
  const [montantCopie, setMontantCopie] = useState(false);

  /**
   * Copie la somme sans espaces ni devise : c'est ce que le champ de la page de
   * paiement attend. « 124 500 FCFA » collé tel quel y serait refusé.
   *
   * `navigator.clipboard` n'existe pas partout — vieux navigateurs, pages non
   * sécurisées. Le repli passe par un champ temporaire plutôt que d'échouer en
   * silence sur le téléphone d'un client.
   */
  const copierMontant = async (montant: number) => {
    const brut = String(montant);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(brut);
      } else {
        const champ = document.createElement('textarea');
        champ.value = brut;
        champ.setAttribute('readonly', '');
        champ.style.position = 'fixed';
        champ.style.opacity = '0';
        document.body.appendChild(champ);
        champ.select();
        document.execCommand('copy');
        document.body.removeChild(champ);
      }
      setMontantCopie(true);
      setTimeout(() => setMontantCopie(false), 2500);
    } catch {
      toast.info(`Montant à saisir : ${brut}`);
    }
  };
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoadingParams(true);
      const { data } = await supabase
        .from(CANAUX_PAIEMENT_TABLE)
        .select('*')
        .eq('actif', true)
        .order('ordre')
        .order('created_at');
      setCanaux((data as CanalPaiement[]) ?? []);
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
        supplement_transporteur_fcfa: coutLivraison,
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

    // Le coût d'achat n'est pas envoyé d'ici : il ne figure pas dans la vue
    // publique des produits, et le faire transiter par le navigateur
    // exposerait nos prix fournisseur. Un déclencheur le fige côté base au
    // moment de l'insertion.
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

    setMontantAPayer(totalAPayer);
    clearCart();
    setSubmitting(false);
    setCommandeCreee(commande.reference_publique);
  };

  if (commandeCreee) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeaderGP />
        <main className="entree-page mx-auto max-w-screen-md px-4 py-16 text-center sm:px-6">
          <div className="rounded-lg border bg-card p-8">
            <h1 className="text-xl font-bold text-foreground">Commande enregistrée !</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Référence : <span className="font-semibold text-foreground">{commandeCreee}</span>
            </p>
            {/* Ne jamais annoncer « les instructions ci-dessous » sans rien
                en dessous. Un client invité à payer sans savoir où abandonne,
                et il a raison. */}
            {canaux.length > 0 ? (
              <>
                <p className="mt-4 text-sm text-foreground">
                  Réglez sur l'un des comptes ci-dessous, puis rendez-vous dans « Mes commandes » et
                  déclarez votre paiement avec sa référence ou son reçu. Nous vérifions la réception
                  avant de préparer votre commande.
                </p>
                <div className="mt-6 space-y-3 text-left">
                  {canaux.map((c) => (
                    <div key={c.id} className="rounded-md border p-4">
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        {c.type_canal === 'virement' ? (
                          <Landmark className="h-4 w-4 shrink-0" />
                        ) : c.type_canal === 'lien_paiement' ? (
                          <ExternalLink className="h-4 w-4 shrink-0" />
                        ) : (
                          <Smartphone className="h-4 w-4 shrink-0" />
                        )}
                        <span className="break-words">{c.libelle}</span>
                      </p>

                      {/* Un lien se clique, il ne se recopie pas. Afficher son
                          URL en toutes lettres inviterait à la retaper à la
                          main, avec les fautes de frappe que cela suppose. */}
                      {c.type_canal === 'lien_paiement' ? (
                        <div className="mt-2 space-y-2">
                          <Button asChild className="w-full">
                            <a href={c.numero} target="_blank" rel="noreferrer noopener">
                              Payer {montantAPayer.toLocaleString('fr-FR')} FCFA
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                          </Button>
                          {/* Le lien est ouvert : c'est le client qui saisit la
                              somme. Le rappeler ne suffit pas — sur un téléphone,
                              retenir six chiffres en basculant d'application est
                              exactement là où l'on se trompe. Le presse-papier
                              supprime la saisie. */}
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                              Saisissez exactement{' '}
                              <span className="font-semibold text-foreground">
                                {montantAPayer.toLocaleString('fr-FR')} FCFA
                              </span>{' '}
                              sur la page de paiement.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() => copierMontant(montantAPayer)}
                            >
                              {montantCopie ? (
                                <Check className="mr-1.5 h-4 w-4" />
                              ) : (
                                <Copy className="mr-1.5 h-4 w-4" />
                              )}
                              {montantCopie ? 'Copié' : 'Copier'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 break-words text-sm text-muted-foreground">
                          {c.type_canal === 'virement' ? 'IBAN / RIB' : 'Numéro'} : {c.numero}
                          {c.titulaire && (
                            <>
                              <br />
                              Titulaire : {c.titulaire}
                            </>
                          )}
                        </p>
                      )}

                      {c.instructions && (
                        <p className="mt-1 break-words text-xs italic text-muted-foreground">
                          {c.instructions}
                        </p>
                      )}
                    </div>
                  ))}
                  {/* La référence est ce qui rapproche un règlement d'une
                      commande. Un virement a un champ « motif » pour la porter ;
                      un lien de paiement marchand, pas toujours. La formulation
                      couvre les deux plutôt que de demander l'impossible à qui
                      paie par lien. */}
                  <p className="text-sm text-foreground">
                    Gardez la référence <span className="font-semibold">{commandeCreee}</span> sous
                    la main : elle vous sera demandée pour déclarer votre règlement. Si votre moyen
                    de paiement propose un champ « motif », indiquez-la dedans.
                  </p>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4 text-left">
                <p className="text-sm text-foreground">
                  Nos coordonnées de règlement ne sont pas affichables pour le moment. Notre équipe
                  vous contacte au {telephoneDestinataire || 'numéro indiqué'} pour convenir du
                  paiement — votre commande est bien enregistrée et rien n'est perdu.
                </p>
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
                    <>
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
                        Nous préférons vous le dire maintenant plutôt qu'après votre paiement.
                      </p>
                    </div>

                    {/* Ce n'est pas un refus, c'est un changement de mode.
                        Une armoire ne rentre dans aucun colis express — elle
                        voyage en groupage maritime, et c'est exactement le
                        métier de la maison. Renvoyer le client en lui disant
                        « retirez-le de votre panier » revenait à refuser une
                        vente qu'on sait faire. */}
                    <div className="mt-3 rounded-md border border-primary/40 bg-primary/5 p-3">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Ship className="h-4 w-4 text-primary" />
                        Nous pouvons quand même vous l’apporter
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        Les articles volumineux ne partent pas en colis express : ils voyagent en
                        groupage, par bateau ou par avion. C’est notre métier de transitaire. Nous
                        vous chiffrons le transport, les droits de douane et la livraison à Abidjan,
                        poste par poste — vous décidez ensuite.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild className="bouton-anime">
                          <Link to={lienGroupage}>
                            <Ship className="mr-1.5 h-4 w-4" />
                            Demander un chiffrage en groupage
                          </Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link to="/boutique/panier">Retirer l’article du panier</Link>
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Le reste de votre panier vous attend : commandez-le normalement une fois
                        l’article volumineux retiré.
                      </p>
                    </div>
                    </>
                  ) : remiseEnCours ? (
                    <div className="mt-2 space-y-2">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  ) : (
                    <>
                      <p className="mb-3 text-xs text-muted-foreground">
                        {fretSepare
                          ? "Tarifs réels du transporteur pour votre colis, sans marge de notre part. Les prix des articles n'incluent pas la livraison."
                          : 'Tarifs du transporteur pour votre colis. La livraison économique est déjà comprise dans les prix affichés.'}
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
                                {fretSepare
                                  ? `${o.prix_fcfa.toLocaleString('fr-FR')} FCFA`
                                  : o.economique
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
                {/* Annoncer les comptes disponibles avant de valider, pas après :
                    un client qui n'a que Wave doit le savoir maintenant. */}
                {!loadingParams &&
                  (canaux.length > 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Comptes disponibles :{' '}
                      <span className="text-foreground">
                        {canaux.map((c) => c.libelle).join(', ')}
                      </span>
                      . Les coordonnées complètes s'affichent dès votre commande validée.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Nos coordonnées de règlement ne sont pas affichables en ligne pour le moment :
                      notre équipe vous contactera pour convenir du paiement.
                    </p>
                  ))}
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
                {coutLivraison > 0 && optionRetenue && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-foreground">
                      Livraison {optionRetenue.transporteur}
                      {optionRetenue.delai && (
                        <span className="block text-xs text-muted-foreground">
                          {fretSepare
                            ? `Colis groupé, livré sous ${optionRetenue.delai} jours.`
                            : `Sous ${optionRetenue.delai} jours au lieu de la livraison économique.`}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium text-foreground">
                      + {coutLivraison.toLocaleString('fr-FR')} FCFA
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
              {/* L'acceptation est portée par le bouton lui-même plutôt que par
                  une case à cocher : une case de plus entre le client et le
                  paiement fait abandonner des commandes, et l'acceptation par
                  l'acte de commander est celle qui vaut ici. Le lien reste
                  visible et cliquable avant de valider — c'est ce qui rend les
                  conditions opposables. */}
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                En confirmant, vous acceptez les{' '}
                <Link
                  to="/conditions-generales"
                  target="_blank"
                  className="font-medium text-primary hover:underline"
                >
                  conditions générales de vente
                </Link>
                . Votre paiement est conservé jusqu’à votre confirmation de réception.
              </p>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
