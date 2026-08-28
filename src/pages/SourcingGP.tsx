import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import ImageOuverture from '@/components/ImageOuverture';
import { useAuth } from '@/hooks/useAuth';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  DEMANDES_SOURCING_TABLE,
  STATUT_SOURCING_LABELS,
  STATUT_SOURCING_MESSAGES,
  type DemandeSourcing,
  type StatutSourcing,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useReferencement } from '@/hooks/useReferencement';

const BADGE_VARIANT: Record<StatutSourcing, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  nouvelle: 'secondary',
  transmise: 'secondary',
  cotee: 'outline',
  devis_envoye: 'default',
  acceptee: 'default',
  refusee: 'destructive',
  abandonnee: 'destructive',
};

export default function SourcingGP() {
  useReferencement({
    titre: "Sourcing sur demande — nous cherchons le produit pour vous",
    description:
      "L'article n'est pas au catalogue ? Décrivez-le : nous interrogeons nos fournisseurs et revenons vers vous avec un prix rendu Abidjan, tout compris.",
  });

  const { user, loading: authLoading, profilEnCours } = useAuth();
  const navigate = useNavigate();

  const [demandes, setDemandes] = useState<DemandeSourcing[]>([]);
  const [loading, setLoading] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [reponseEnCours, setReponseEnCours] = useState<string | null>(null);

  // La boutique renvoie ici avec ce que le visiteur cherchait : lui faire
  // retaper son article après une recherche infructueuse, c'est le perdre.
  const [parametres] = useSearchParams();
  const [designation, setDesignation] = useState(parametres.get('designation') ?? '');
  const [lien, setLien] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [prixCible, setPrixCible] = useState('');
  const [precisions, setPrecisions] = useState('');

  const charger = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from(DEMANDES_SOURCING_TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setDemandes((data as DemandeSourcing[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const soumettre = async () => {
    if (!user) {
      navigate('/boutique/compte');
      return;
    }
    if (designation.trim().length < 3) {
      toast.error("Décrivez l'article recherché en quelques mots.");
      return;
    }
    const qte = Math.max(1, Math.round(Number(quantite) || 1));
    const cible = Number(prixCible);

    setEnvoi(true);
    const { error } = await supabase.from(DEMANDES_SOURCING_TABLE).insert({
      user_id: user.id,
      designation: designation.trim(),
      lien_reference: lien.trim() || null,
      quantite_souhaitee: qte,
      prix_cible_fcfa: Number.isFinite(cible) && cible > 0 ? Math.round(cible) : null,
      precisions: precisions.trim() || null,
    });
    setEnvoi(false);

    if (error) {
      toast.error("Votre demande n'a pas pu être enregistrée. Réessayez.");
      return;
    }
    toast.success('Demande enregistrée. Nous lançons la recherche.');
    setDesignation('');
    setLien('');
    setQuantite('1');
    setPrixCible('');
    setPrecisions('');
    charger();
  };

  const repondre = async (demande: DemandeSourcing, action: 'accepter' | 'abandonner') => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error('Session expirée, reconnectez-vous.');
      return;
    }
    setReponseEnCours(demande.id);
    try {
      const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_sourcing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, demande_id: demande.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Une erreur est survenue.');
      toast.success(
        action === 'accepter'
          ? 'Merci ! Nous vous recontactons pour finaliser.'
          : 'Demande abandonnée.',
      );
      charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setReponseEnCours(null);
    }
  };

  if (authLoading || (user && profilEnCours)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />

      {/* ---------- Ouverture ----------
          Le sourcing arrivait jusqu'ici par un titre nu sur fond blanc, alors
          que c'est le service qui demande le plus de confiance : on demande à
          quelqu'un de nous confier une recherche et de nous croire sur le prix
          qui reviendra. Une image d'entrepôt dit en une seconde ce que trois
          paragraphes n'établissent pas — qu'il y a des vraies marchandises,
          des vrais fournisseurs et une maison derrière. */}
      <section className="relative flex min-h-[24rem] items-center overflow-hidden bg-foreground sm:min-h-[28rem]">
        {/* Le cadrage est remonté à 26 % : la bande d'ouverture est bien plus
            large que haute, et un recadrage centré coupait le visage de la
            personne au profit du plan de travail. On garde les yeux, on perd
            un peu de sol. */}
        <ImageOuverture
          src="/visuels/sourcing-selection.jpg"
          alt=""
          largeur={1168}
          hauteur={784}
          className="absolute inset-0 h-full w-full scale-105 object-cover object-[center_26%] motion-safe:animate-[respiration_26s_ease-in-out_infinite]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/80 to-foreground/35" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
        {/* `w-full` n'est pas décoratif : la section est en « flex », donc ce
            conteneur devient un élément flexible et se réduit à la largeur
            de son contenu. Sans lui, « mx-auto » centre un bloc rétréci et le
            titre ne s'aligne plus sur le formulaire juste en dessous —
            deux cents pixels de décalage, visibles à l'œil nu. */}
        <div className="relative mx-auto w-full max-w-screen-lg px-4 py-16 sm:px-6 sm:py-20">
          <div className="rideau max-w-xl">
            <p className="flex items-center gap-2 font-display text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary sm:text-xs">
              <Sparkles className="h-4 w-4" />
              Sourcing sur demande
            </p>
            <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
              Vous ne trouvez pas votre article&nbsp;?
              <span className="mt-1 block bg-gradient-to-r from-primary via-amber-300 to-primary bg-clip-text text-transparent">
                Nous allons le chercher.
              </span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/80">
              Décrivez-le : nous le cherchons chez nos fournisseurs et nous vous annonçons un prix
              ferme, transport et assurance compris. Vous décidez ensuite — rien n'est engagé
              avant votre accord.
            </p>
          </div>
        </div>
      </section>

      <main className="entree-page mx-auto max-w-screen-lg px-4 py-8 sm:px-6">

        <section className="carte-reactive mt-6 rounded-lg border bg-card p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="designation">Article recherché</Label>
              <Input
                id="designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="ex : casque audio sans fil à réduction de bruit"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lien">Lien vers un exemple (facultatif)</Label>
              <Input
                id="lien"
                value={lien}
                onChange={(e) => setLien(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantite">Quantité souhaitée</Label>
              <Input
                id="quantite"
                type="number"
                min={1}
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Le prix dépend de la quantité : le transport se dilue sur le lot.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cible">Prix cible par pièce (FCFA, facultatif)</Label>
              <Input
                id="cible"
                type="number"
                min={0}
                value={prixCible}
                onChange={(e) => setPrixCible(e.target.value)}
                placeholder="ex : 15000"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="precisions">Précisions (couleur, taille, marque…)</Label>
              <Textarea
                id="precisions"
                rows={3}
                value={precisions}
                onChange={(e) => setPrecisions(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={soumettre} disabled={envoi}>
              {envoi ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Lancer la recherche
            </Button>
            {!user && (
              <p className="text-xs text-muted-foreground">
                <Link to="/boutique/compte" className="underline">
                  Connectez-vous
                </Link>{' '}
                pour suivre votre demande.
              </p>
            )}
          </div>
        </section>

        {/* ---------- Ce qui se passe après ----------
            Une demande de sourcing part sur une promesse, et le client la fait
            à des inconnus : il décrit un article, et il attend. Sans rien lui
            montrer de la suite, il n'a aucune raison de croire que sa demande
            va quelque part. Ces trois étapes disent ce qui se passe entre son
            message et son colis — et la photographie d'entrepôt les ancre dans
            un lieu réel. C'est le seul argument qui vaut à ce moment-là. */}
        <section className="mt-12 overflow-hidden rounded-xl border bg-card" data-revele>
          <div className="grid items-stretch lg:grid-cols-2">
            <div className="cadre-zoom order-1 min-h-[14rem] lg:order-2 lg:min-h-full">
              {/* Celle-ci est différée : elle est en bas de page. Elle gagne
                  le WebP comme les autres, mais garde `loading="lazy"` — lui
                  donner la priorité volerait de la bande passante à ce que le
                  visiteur regarde vraiment. */}
              <picture>
                <source srcSet="/visuels/sourcing-entrepot.webp" type="image/webp" />
                <img
                  src="/visuels/sourcing-entrepot.jpg"
                  alt="Contrôle d'un colis en entrepôt avant expédition."
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </picture>
            </div>
            <div className="order-2 p-6 lg:order-1 lg:p-8">
              <h2 className="trait-anime font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Ce qui se passe après votre demande
              </h2>
              <ol className="mt-6 space-y-5" data-revele-cascade>
                {[
                  {
                    n: '1',
                    titre: 'On cherche à la source',
                    texte:
                      "Chine, Turquie, Europe, Maghreb. On interroge plusieurs fournisseurs pour le même article et on retient celui qui revient le moins cher une fois les droits de douane comptés — pas celui qui affiche le prix d'achat le plus bas.",
                  },
                  {
                    n: '2',
                    titre: 'On contrôle avant d’expédier',
                    texte:
                      'La marchandise est vérifiée à notre entrepôt : quantité, référence, état. Un article non conforme ne prend pas l’avion — il repart chez le fournisseur, et vous ne payez pas le fret d’un colis à refuser.',
                  },
                  {
                    n: '3',
                    titre: 'On vous annonce un prix rendu Abidjan',
                    texte:
                      'Marchandise, fret, assurance, douane et livraison dans un seul chiffre. Vous décidez après l’avoir vu — rien n’est engagé avant votre accord.',
                  },
                ].map((e) => (
                  <li key={e.n} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
                      {e.n}
                    </span>
                    <div>
                      <h3 className="font-display text-base font-bold text-foreground">{e.titre}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.texte}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {user && (
          <section className="mt-8">
            <h2 className="trait-anime text-lg font-semibold text-foreground">Mes recherches</h2>
            {loading ? (
              <div className="mt-3 space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : demandes.length === 0 ? (
              <p className="mt-3 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Aucune recherche en cours.
              </p>
            ) : (
              <div className="cascade mt-3 space-y-3">
                {demandes.map((d) => (
                  <article key={d.id} className="carte-reactive rounded-lg border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{d.designation}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.reference_publique} · {d.quantite_souhaitee} pièce
                          {d.quantite_souhaitee > 1 ? 's' : ''} ·{' '}
                          {new Date(d.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <Badge variant={BADGE_VARIANT[d.statut]}>
                        {STATUT_SOURCING_LABELS[d.statut]}
                      </Badge>
                    </div>

                    <p className="mt-2 text-sm text-muted-foreground">
                      {STATUT_SOURCING_MESSAGES[d.statut]}
                    </p>

                    {d.statut === 'devis_envoye' && d.prix_propose_fcfa != null && (
                      <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Prix proposé : </span>
                          <span className="text-lg font-semibold text-foreground">
                            {d.prix_propose_fcfa.toLocaleString('fr-FR')} FCFA
                          </span>
                          <span className="text-muted-foreground"> / pièce</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Soit {(d.prix_propose_fcfa * d.quantite_souhaitee).toLocaleString('fr-FR')}{' '}
                          FCFA pour {d.quantite_souhaitee} pièce
                          {d.quantite_souhaitee > 1 ? 's' : ''}
                          {d.delai_source_jours ? ` · livraison estimée ${d.delai_source_jours} jours` : ''}
                        </p>
                        {d.commentaire_admin && (
                          <p className="mt-2 text-xs text-muted-foreground">{d.commentaire_admin}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => repondre(d, 'accepter')}
                            disabled={reponseEnCours === d.id}
                          >
                            {reponseEnCours === d.id ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1.5 h-4 w-4" />
                            )}
                            J'accepte ce prix
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => repondre(d, 'abandonner')}
                            disabled={reponseEnCours === d.id}
                          >
                            <XCircle className="mr-1.5 h-4 w-4" />
                            Non merci
                          </Button>
                        </div>
                      </div>
                    )}

                    {d.statut !== 'devis_envoye' && d.commentaire_admin && (
                      <p className="mt-2 rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                        {d.commentaire_admin}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
