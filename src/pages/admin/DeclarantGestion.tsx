import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '@/components/AdminNav';
import {
  supabase,
  PROFILES_TABLE,
  type ApercuDeclarantAdmin,
  type FormuleIAAdmin,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Gauge,
  Users,
  Calculator,
  Sparkles,
  Coins,
  Loader2,
  Save,
  AlertTriangle,
  ExternalLink,
  Search,
  UserPlus,
  X,
} from 'lucide-react';

/**
 * Le Déclarant, côté maison.
 *
 * Cet écran existe pour une raison très concrète : les trois formules sont à
 * ZÉRO FRANC en base, et ce n'est pas à moi de décider ce qu'elles valent. Un
 * prix inventé dans le code devient un engagement commercial dès qu'un
 * visiteur le lit. Il fallait donc l'endroit où le fondateur le pose lui-même.
 *
 * Ce que l'écran montre, dans cet ordre :
 *
 *  1. **Ce que le service produit** — requêtes, classifications, liquidations,
 *     droits calculés. C'est l'argument de vente du service, chiffré.
 *  2. **Les formules, modifiables** — prix, plafond, avantages. Le code d'une
 *     formule n'est pas modifiable ici, volontairement : les abonnements en
 *     cours le portent, et le changer les débrancherait tous d'un clic.
 *  3. **Qui consomme le plus** — c'est là que se trouvent les abonnements à
 *     vendre.
 *
 * La « recette mensuelle » affichée est un produit de multiplication, pas un
 * encaissement. C'est écrit à côté du chiffre : tant que la souscription se
 * fait de la main à la main, seule la comptabilité dit ce qui est entré.
 */

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/** Une formule en cours d'édition. Les champs restent des chaînes tant qu'on
 *  tape : un champ numérique vidé ne doit pas devenir zéro sous les doigts. */
interface Brouillon {
  libelle: string;
  prix: string;
  plafond: string;
  avantages: string;
}

const brouillonDe = (f: FormuleIAAdmin): Brouillon => ({
  libelle: f.libelle,
  prix: String(f.prix_mensuel_fcfa ?? 0),
  plafond: String(f.requetes_par_jour ?? 0),
  avantages: (f.avantages ?? []).join('\n'),
});

function Compteur({
  icone: Icone,
  titre,
  valeur,
  detail,
}: {
  icone: typeof Gauge;
  titre: string;
  valeur: string;
  detail: string;
}) {
  return (
    <div className="carte-reactive reflet rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5">
        <Icone className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titre}</p>
      </div>
      <p className="mt-2 font-display text-xl font-extrabold tabular-nums text-foreground">
        {valeur}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

/** Un compte, tel qu'on le cherche pour lui accorder une formule. */
interface CompteTrouve {
  user_id: string;
  nom_complet: string | null;
  nom_entreprise: string | null;
  type_compte: string | null;
}

export default function DeclarantGestion() {
  const [apercu, setApercu] = useState<ApercuDeclarantAdmin | null>(null);
  const [brouillons, setBrouillons] = useState<Record<string, Brouillon>>({});
  const [enregistre, setEnregistre] = useState<string | null>(null);

  /* ---- Accorder un abonnement à la main ----
   * Il n'y a pas de paiement en ligne pour ce service : quelqu'un doit
   * pouvoir inscrire une souscription payée par virement ou en espèces. La
   * note n'est pas décorative — sans elle, personne ne saura dans six mois
   * pourquoi ce compte a la formule Cabinet. */
  const [recherche, setRecherche] = useState('');
  const [comptes, setComptes] = useState<CompteTrouve[] | null>(null);
  const [choisi, setChoisi] = useState<CompteTrouve | null>(null);
  const [formuleChoisie, setFormuleChoisie] = useState('');
  const [jusquau, setJusquau] = useState('');
  const [note, setNote] = useState('');
  const [accord, setAccord] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('app_e08c374bc4_declarant_admin_apercu');
    if (error) {
      toast.error(error.message);
      return;
    }
    const a = data as ApercuDeclarantAdmin;
    setApercu(a);
    setBrouillons(Object.fromEntries(a.formules.map((f) => [f.code, brouillonDe(f)])));
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const majBrouillon = (code: string, champ: keyof Brouillon, valeur: string) =>
    setBrouillons((b) => ({ ...b, [code]: { ...b[code], [champ]: valeur } }));

  const enregistrer = async (f: FormuleIAAdmin) => {
    const b = brouillons[f.code];
    if (!b) return;

    const prix = Number(b.prix);
    const plafond = Number(b.plafond);
    if (!Number.isFinite(prix) || prix < 0) {
      toast.error('Le prix mensuel doit être un nombre positif.');
      return;
    }
    if (!Number.isFinite(plafond) || plafond < 0) {
      toast.error('Le plafond quotidien doit être un nombre positif.');
      return;
    }

    setEnregistre(f.code);
    const { error } = await supabase.rpc('app_e08c374bc4_regler_formule_ia', {
      p_code: f.code,
      p_prix_mensuel_fcfa: prix,
      p_requetes_par_jour: Math.round(plafond),
      p_libelle: b.libelle,
      p_avantages: b.avantages
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    });
    setEnregistre(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Formule ${b.libelle} enregistrée.`);
    void charger();
  };

  const modifiee = (f: FormuleIAAdmin) => {
    const b = brouillons[f.code];
    if (!b) return false;
    const ref = brouillonDe(f);
    return (
      b.libelle !== ref.libelle ||
      b.prix !== ref.prix ||
      b.plafond !== ref.plafond ||
      b.avantages !== ref.avantages
    );
  };

  const chercherCompte = async () => {
    const texte = recherche.trim();
    if (texte.length < 2) {
      toast.error('Deux caractères au minimum pour chercher un compte.');
      return;
    }
    const { data, error } = await supabase
      .from(PROFILES_TABLE)
      .select('user_id, nom_complet, nom_entreprise, type_compte')
      .or(`nom_complet.ilike.%${texte}%,nom_entreprise.ilike.%${texte}%`)
      .limit(20);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComptes((data as CompteTrouve[]) ?? []);
  };

  const accorder = async () => {
    if (!choisi || !formuleChoisie) return;
    setAccord(true);
    const { error } = await supabase.rpc('app_e08c374bc4_accorder_abonnement_ia', {
      p_utilisateur: choisi.user_id,
      p_formule: formuleChoisie,
      p_jusquau: jusquau || null,
      p_note: note || null,
    });
    setAccord(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Abonnement accordé.');
    setChoisi(null);
    setComptes(null);
    setRecherche('');
    setFormuleChoisie('');
    setJusquau('');
    setNote('');
    void charger();
  };

  const retirer = async (utilisateurId: string, nom: string) => {
    const { error } = await supabase.rpc('app_e08c374bc4_retirer_abonnement_ia', {
      p_utilisateur: utilisateurId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Abonnement de ${nom} retiré.`);
    void charger();
  };

  const sansPrix = apercu?.formules.filter((f, i) => i > 0 && f.prix_mensuel_fcfa === 0) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:px-6">
          <AdminNav />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="trait-anime flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Admin — Le Déclarant
            </h1>
            <Button asChild variant="outline" size="sm" className="bouton-anime">
              <Link to="/declarant">
                Voir la page publique
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="entree-page mx-auto max-w-screen-xl space-y-8 px-4 py-6 sm:px-6">
        {!apercu ? (
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Le seul avertissement qui compte tant que rien n'est vendu. */}
            {sansPrix.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-50/40 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {sansPrix.length === 1
                      ? 'Une formule payante est encore à zéro franc.'
                      : `${sansPrix.length} formules payantes sont encore à zéro franc.`}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    La page publique affiche « Tarif à venir » pour{' '}
                    {sansPrix.map((f) => f.libelle).join(' et ')} — elle ne les annonce pas comme
                    gratuites, et ne peut pas les vendre. Posez le prix ci-dessous : il s’applique
                    immédiatement.
                  </p>
                </div>
              </div>
            )}

            {/* 1. Ce que le service produit. */}
            <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6" data-revele-cascade>
              <Compteur
                icone={Gauge}
                titre="Requêtes aujourd’hui"
                valeur={apercu.activite.requetes_aujourdhui.toLocaleString('fr-FR')}
                detail="Classifications assistées"
              />
              <Compteur
                icone={Gauge}
                titre="Requêtes sur 30 j"
                valeur={apercu.activite.requetes_30j.toLocaleString('fr-FR')}
                detail="Toutes formules confondues"
              />
              <Compteur
                icone={Users}
                titre="Comptes actifs"
                valeur={apercu.activite.comptes_actifs_30j.toLocaleString('fr-FR')}
                detail="Ayant consommé sur 30 jours"
              />
              <Compteur
                icone={Sparkles}
                titre="Classifications"
                valeur={apercu.activite.classifications.toLocaleString('fr-FR')}
                detail="Depuis l’ouverture du service"
              />
              <Compteur
                icone={Calculator}
                titre="Liquidations"
                valeur={apercu.activite.liquidations.toLocaleString('fr-FR')}
                detail="Bulletins archivés"
              />
              <Compteur
                icone={Coins}
                titre="Droits calculés"
                valeur={fcfa(apercu.activite.droits_calcules_fcfa)}
                detail="Cumul des liquidations"
              />
            </section>

            {/* 2. Les formules, réglables. */}
            <section>
              <h2 className="trait-anime font-display text-base font-bold text-foreground">
                Les formules
              </h2>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                Le code d’une formule n’est pas modifiable : les abonnements en cours le portent,
                et le changer les débrancherait tous. Le libellé, le prix, le plafond et les
                avantages le sont.
              </p>

              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                {apercu.formules.map((f) => {
                  const b = brouillons[f.code];
                  if (!b) return null;
                  return (
                    <div key={f.code} className="carte-reactive rounded-xl border bg-card p-5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {f.code}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {f.abonnes} abonné{f.abonnes > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div>
                          <Label htmlFor={`lib-${f.code}`} className="text-xs">
                            Libellé
                          </Label>
                          <Input
                            id={`lib-${f.code}`}
                            value={b.libelle}
                            onChange={(e) => majBrouillon(f.code, 'libelle', e.target.value)}
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`prix-${f.code}`} className="text-xs">
                              Prix mensuel (FCFA)
                            </Label>
                            <Input
                              id={`prix-${f.code}`}
                              inputMode="numeric"
                              value={b.prix}
                              onChange={(e) => majBrouillon(f.code, 'prix', e.target.value)}
                              className="tabular-nums"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`plaf-${f.code}`} className="text-xs">
                              Requêtes par jour
                            </Label>
                            <Input
                              id={`plaf-${f.code}`}
                              inputMode="numeric"
                              value={b.plafond}
                              onChange={(e) => majBrouillon(f.code, 'plafond', e.target.value)}
                              className="tabular-nums"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`av-${f.code}`} className="text-xs">
                            Avantages — un par ligne
                          </Label>
                          <Textarea
                            id={`av-${f.code}`}
                            rows={4}
                            value={b.avantages}
                            onChange={(e) => majBrouillon(f.code, 'avantages', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Recette théorique</p>
                          <p className="font-display text-sm font-bold tabular-nums text-foreground">
                            {fcfa(f.recette_mensuelle_fcfa)} / mois
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="bouton-anime"
                          disabled={!modifiee(f) || enregistre === f.code}
                          onClick={() => void enregistrer(f)}
                        >
                          {enregistre === f.code ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-1.5 h-4 w-4" />
                          )}
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 rounded-md border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Recette théorique</strong> = prix × abonnés
                actifs. Ce n’est pas un encaissement : la souscription se fait encore de la main à
                la main, et seule la comptabilité dit ce qui est réellement entré en caisse.
              </p>
            </section>

            {/* 3. Qui consomme, qui est abonné. */}
            <section className="grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="trait-anime font-display text-base font-bold text-foreground">
                  Les plus actifs sur 30 jours
                </h2>
                {apercu.plus_actifs.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Personne n’a encore utilisé la classification assistée.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y rounded-xl border bg-card">
                    {apercu.plus_actifs.map((u) => (
                      <li
                        key={u.utilisateur_id}
                        className="flex items-center justify-between gap-3 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{u.nom}</p>
                          <p className="text-xs text-muted-foreground">
                            {u.type_compte ?? 'compte'} · formule {u.formule}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 tabular-nums">
                          {u.requetes_30j}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h2 className="trait-anime font-display text-base font-bold text-foreground">
                  Abonnements en cours
                </h2>
                {apercu.abonnes.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Aucun abonnement accordé. Tous les comptes sont en formule d’entrée.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y rounded-xl border bg-card">
                    {apercu.abonnes.map((a) => (
                      <li
                        key={a.utilisateur_id}
                        className="flex items-center justify-between gap-3 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{a.nom}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.actif_jusquau
                              ? `jusqu’au ${new Date(a.actif_jusquau).toLocaleDateString('fr-FR')}`
                              : 'sans terme'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline">{a.formule}</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void retirer(a.utilisateur_id, a.nom)}
                          >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Retirer l’abonnement</span>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Accorder une formule : la souscription se fait encore de la
                    main à la main, il faut donc pouvoir l'inscrire ici. */}
                <div className="carte-reactive mt-5 rounded-xl border bg-card p-4">
                  <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                    <UserPlus className="h-4 w-4 text-primary" />
                    Accorder une formule
                  </h3>

                  <div className="mt-3 flex gap-2">
                    <Input
                      value={recherche}
                      onChange={(e) => setRecherche(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void chercherCompte()}
                      placeholder="Nom du client ou de l’entreprise"
                    />
                    <Button variant="outline" onClick={() => void chercherCompte()}>
                      <Search className="h-4 w-4" />
                      <span className="sr-only">Chercher</span>
                    </Button>
                  </div>

                  {comptes !== null && !choisi && (
                    <div className="mt-3">
                      {comptes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Aucun compte à ce nom. Le client doit d’abord s’inscrire sur le site.
                        </p>
                      ) : (
                        <ul className="divide-y rounded-lg border">
                          {comptes.map((c) => (
                            <li key={c.user_id}>
                              <button
                                type="button"
                                onClick={() => setChoisi(c)}
                                className="flex w-full items-center justify-between gap-2 p-2.5 text-left hover:bg-muted/50"
                              >
                                <span className="truncate text-sm text-foreground">
                                  {c.nom_complet || c.nom_entreprise || 'Compte sans nom'}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {c.type_compte ?? 'compte'}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {choisi && (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {choisi.nom_complet || choisi.nom_entreprise || 'Compte sans nom'}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => setChoisi(null)}>
                          <X className="h-4 w-4" />
                          <span className="sr-only">Changer de compte</span>
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="formule-accordee" className="text-xs">
                            Formule
                          </Label>
                          <select
                            id="formule-accordee"
                            value={formuleChoisie}
                            onChange={(e) => setFormuleChoisie(e.target.value)}
                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                          >
                            <option value="">Choisir…</option>
                            {apercu.formules.map((f) => (
                              <option key={f.code} value={f.code}>
                                {f.libelle}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="jusquau" className="text-xs">
                            Actif jusqu’au (vide = sans terme)
                          </Label>
                          <Input
                            id="jusquau"
                            type="date"
                            value={jusquau}
                            onChange={(e) => setJusquau(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="note-abonnement" className="text-xs">
                          Comment il a été payé
                        </Label>
                        <Input
                          id="note-abonnement"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Virement du 12/09, reçu n° 41…"
                        />
                      </div>

                      <Button
                        className="bouton-anime w-full"
                        disabled={!formuleChoisie || accord}
                        onClick={() => void accorder()}
                      >
                        {accord ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="mr-1.5 h-4 w-4" />
                        )}
                        Accorder
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
