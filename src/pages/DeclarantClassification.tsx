import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import NavDeclarant from '@/components/NavDeclarant';
import SiteFooter from '@/components/SiteFooter';
import AlerteMarchandiseReglementee from '@/components/AlerteMarchandiseReglementee';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  CLASSIFICATIONS_HS_TABLE,
  type ClassificationHs,
  type ClassificationEnregistree,
  type QuotaClassification,
} from '@/lib/supabase';
import { REGLES_RGI, NIVEAUX_DESCENTE } from '@/lib/rgi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ChevronRight,
  Scale,
  FileText,
  History,
  ArrowRight,
  BookOpen,
  Gauge,
} from 'lucide-react';

/**
 * La classification, sur sa propre page.
 *
 * Le fondateur : « classer une marchandise grâce à l'IA doit avoir sa propre
 * page, avec toutes les explications, de la classification au résultat, et la
 * classification est faite selon les Règles Générales Interprétatives ».
 *
 * CE QUE CETTE PAGE DOIT RÉUSSIR, ET QUI EST PARTICULIER
 *
 * Un classement douanier ne vaut que si on peut le DÉFENDRE. Rendre un code
 * sans le raisonnement, c'est donner au déclarant quelque chose qu'il ne
 * pourra pas justifier devant un vérificateur — et qu'il ne pourra pas voir
 * faux non plus.
 *
 * D'où la structure : ce qu'on a compris de la marchandise, la descente niveau
 * par niveau, les RGI appliquées, puis la confrontation au tarif officiel. Le
 * code arrive en dernier, pas en premier.
 *
 * LA LIGNE QUI NE BOUGE PAS
 *
 * Tant que le code n'est pas confirmé dans le corpus TEC, AUCUN taux n'est
 * affiché. Ni approché, ni « à titre indicatif ». Un taux inventé sur une page
 * de classement devient un prix annoncé à un client, puis un écart à la
 * liquidation, puis une facture qu'il faut refaire.
 */

export default function DeclarantClassification() {
  const navigate = useNavigate();
  const [marchandise, setMarchandise] = useState('');
  const [resultat, setResultat] = useState<ClassificationHs | null>(null);
  const [encours, setEncours] = useState(false);
  const [quota, setQuota] = useState<QuotaClassification | null>(null);
  const [historique, setHistorique] = useState<ClassificationEnregistree[] | null>(null);
  const [reglesOuvertes, setReglesOuvertes] = useState(false);

  const charger = async () => {
    const { data: q } = await supabase.rpc('app_e08c374bc4_quota_classification');
    const lu = q as QuotaClassification | null;
    setQuota(lu);
    if (!lu?.connecte) {
      setHistorique(null);
      return;
    }
    const { data } = await supabase
      .from(CLASSIFICATIONS_HS_TABLE)
      .select('id, description, code_propose, designation_tec, verifie_en_base, taux_dd, cree_le')
      .order('cree_le', { ascending: false })
      .limit(8);
    setHistorique((data as ClassificationEnregistree[]) ?? []);
  };

  useEffect(() => {
    void charger();
  }, []);

  const classer = async () => {
    const texte = marchandise.trim();
    if (texte.length < 3) {
      toast.error('Décrivez la marchandise en quelques mots au moins.');
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error('Connectez-vous pour utiliser la classification assistée.');
      return;
    }

    setEncours(true);
    setResultat(null);
    try {
      const reponse = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_classification_hs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ description: texte }),
      });
      const corps = await reponse.json();
      if (!reponse.ok) {
        toast.error(corps?.erreur ?? "La classification n'a pas abouti.");
        return;
      }
      setResultat(corps as ClassificationHs);
      void charger();
    } catch {
      toast.error('Le service est injoignable. Vérifiez votre connexion.');
    } finally {
      setEncours(false);
    }
  };

  /* Le passage à la déclaration sans ressaisie — la demande explicite du
   * fondateur. On transmet par l'état de navigation plutôt que par le stockage
   * local : rien de nouveau à déposer sur l'appareil du client, et la page de
   * déclaration sait aussi reprendre une classification depuis l'historique
   * si l'utilisateur recharge. */
  const versDeclaration = () => {
    if (!resultat) return;
    navigate('/declarant/declaration', {
      state: {
        classification: {
          code: resultat.code_propose,
          designation: resultat.designation_tec ?? resultat.description,
          taux_dd: resultat.taux_dd,
          verifie: resultat.verifie_en_base,
        },
      },
    });
  };

  const descente = resultat
    ? NIVEAUX_DESCENTE.map((n) => ({
        ...n,
        valeur: (resultat as unknown as Record<string, string | null>)[n.cle] ?? null,
      }))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />
      <NavDeclarant />

      <main className="entree-page mx-auto max-w-screen-lg px-4 py-8 sm:px-6">
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          <Sparkles className="h-4 w-4" />
          Classification assistée
        </p>
        <h1 className="trait-anime mt-3 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Sous quel code tombe votre marchandise
        </h1>
        <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
          Le classement se fait selon les Règles Générales Interprétatives du Système harmonisé,
          appliquées dans l’ordre. Vous recevez le code <em>et</em> le raisonnement qui le soutient —
          sans quoi vous ne pourriez ni le défendre devant un vérificateur, ni voir qu’il est faux.
        </p>

        {/* ---------- La saisie ---------- */}
        <section className="carte-reactive mt-7 rounded-xl border bg-card p-5" data-revele>
          <Label htmlFor="marchandise" className="text-sm font-semibold">
            Décrivez la marchandise
          </Label>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Comme vous la décririez à un collègue : <strong>la matière</strong>, la{' '}
            <strong>fonction</strong>, l’<strong>usage</strong>, la présentation. Plus la description
            est précise, moins le classement laisse de place au doute — « chaussures » ne suffit
            pas, « chaussures de sécurité à embout acier, dessus cuir, semelle caoutchouc » tranche.
          </p>
          <Textarea
            id="marchandise"
            rows={3}
            value={marchandise}
            onChange={(e) => setMarchandise(e.target.value)}
            placeholder="ex : armoire 4 portes en panneau de particules mélaminé, avec miroir et éclairage LED, pour chambre"
            className="mt-3"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={() => void classer()} disabled={encours} className="bouton-anime">
              {encours ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Classer la marchandise
            </Button>
            {quota?.connecte && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" />
                {quota.restant} classification{(quota.restant ?? 0) > 1 ? 's' : ''} restante
                {(quota.restant ?? 0) > 1 ? 's' : ''} aujourd’hui
              </span>
            )}
            {quota && !quota.connecte && (
              <Link
                to="/boutique/compte?retour=/declarant/classer"
                className="text-xs font-medium text-primary hover:underline"
              >
                Connectez-vous pour classer
              </Link>
            )}
          </div>
        </section>

        <AlerteMarchandiseReglementee designation={marchandise} />

        {/* ---------- Le résultat ---------- */}
        {resultat && (
          <section className="mt-8 space-y-5" data-revele>
            <h2 className="trait-anime font-display text-lg font-bold text-foreground">
              Le raisonnement, puis le code
            </h2>

            {/* 1. Ce que le moteur a retenu de la marchandise. Le mettre en
                   tête permet de repérer tout de suite un malentendu : si la
                   matière lue est fausse, le reste ne vaut rien. */}
            {resultat.caracteristiques && (
              <div className="rounded-xl border bg-card p-5">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  1. Ce qui a été retenu de votre description
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {resultat.caracteristiques}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Si l’un de ces éléments est faux, le classement l’est aussi. Reformulez et
                  relancez.
                </p>
              </div>
            )}

            {/* 2. La descente. */}
            <div className="rounded-xl border bg-card p-5">
              <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                <ChevronRight className="h-4 w-4 text-primary" />
                2. La descente dans la nomenclature
              </h3>
              <ol className="mt-3 space-y-2">
                {descente.map((n, i) => (
                  <li key={n.cle} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {n.libelle}
                      </p>
                      <p className="text-sm text-foreground">{n.valeur ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{n.aide}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 rounded-md border border-dashed p-2.5 text-xs leading-relaxed text-muted-foreground">
                Le Système harmonisé de l’OMD s’arrête à six chiffres. La nomenclature UEMOA en
                ajoute quatre :{' '}
                <strong className="text-foreground">un code à six chiffres n’est pas déclarable</strong>{' '}
                en Côte d’Ivoire.
              </p>
            </div>

            {/* 3. Les RGI appliquées — le cœur de la demande du fondateur. */}
            {resultat.raisonnement_rgi && (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-5">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <Scale className="h-4 w-4 text-primary" />
                  3. Les règles appliquées
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {resultat.raisonnement_rgi}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Les RGI s’appliquent successivement : on ne passe à la suivante que si la
                  précédente n’a pas tranché. Un classement qui invoque la RGI 3 alors que la RGI 1
                  suffisait est un classement fragile.
                </p>
              </div>
            )}

            {/* 4. La confrontation au tarif. C'est ici que se joue l'honnêteté
                   de tout l'outil. */}
            <div
              className={
                'rounded-xl border p-5 ' +
                (resultat.verifie_en_base
                  ? 'border-emerald-600/40 bg-emerald-50/40'
                  : 'border-amber-500/50 bg-amber-50/40')
              }
            >
              <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                {resultat.verifie_en_base ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                4. Confrontation au Tarif Extérieur Commun
              </h3>

              {resultat.verifie_en_base ? (
                <>
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Position tarifaire</p>
                      <p className="font-display text-2xl font-extrabold tabular-nums text-foreground">
                        {resultat.code_propose}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Droit de douane</p>
                      <p className="font-display text-2xl font-extrabold tabular-nums text-foreground">
                        {resultat.taux_dd} %
                      </p>
                    </div>
                    {resultat.unite_us && (
                      <div>
                        <p className="text-xs text-muted-foreground">Unité statistique</p>
                        <p className="text-sm font-semibold text-foreground">{resultat.unite_us}</p>
                      </div>
                    )}
                  </div>
                  {resultat.designation_tec && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Désignation officielle : </strong>
                      {resultat.designation_tec}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">
                    Ce code n’a pas été confirmé dans le corpus officiel.{' '}
                    <strong>Aucun taux ne vous est donc montré</strong> — pas même approché.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{resultat.mention}</p>
                  {resultat.code_proche_indicatif && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Code voisin trouvé, à titre d’orientation seulement :{' '}
                      <span className="font-semibold tabular-nums text-foreground">
                        {resultat.code_proche_indicatif}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>

            {/* La question du moteur, quand la description ne suffit pas. */}
            {resultat.question && (
              <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-5">
                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Il manque une précision pour trancher
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {resultat.question}
                  </p>
                </div>
              </div>
            )}

            {resultat.notes_declarant && (
              <div className="rounded-xl border bg-card p-5">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Ce qu’il faudra prévoir au dossier
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {resultat.notes_declarant}
                </p>
              </div>
            )}

            {/* Le passage à la déclaration, sans ressaisie. */}
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="bouton-anime"
                onClick={versDeclaration}
                disabled={!resultat.code_propose}
              >
                <FileText className="mr-2 h-4 w-4" />
                Établir la déclaration avec ce code
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button asChild size="lg" variant="outline" className="bouton-anime">
                <Link to="/declarant/atelier">Calculer les droits et taxes</Link>
              </Button>
            </div>

            <p className="rounded-md border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">
                Avis de classement, pas décision de l’administration.
              </strong>{' '}
              Seul le service des douanes tranche un classement de manière opposable. Ce
              raisonnement est là pour préparer votre dossier et défendre votre position, pas pour
              s’y substituer.
            </p>
          </section>
        )}

        {/* ---------- Les règles, dépliables ---------- */}
        <section className="mt-10" data-revele>
          <button
            type="button"
            onClick={() => setReglesOuvertes((o) => !o)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40"
            aria-expanded={reglesOuvertes}
          >
            <span>
              <span className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <Scale className="h-4 w-4 text-primary" />
                Les six Règles Générales Interprétatives
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Ce sont elles qui décident du classement. Elles s’appliquent dans l’ordre.
              </span>
            </span>
            <ChevronRight
              className={'h-5 w-5 shrink-0 text-muted-foreground transition-transform ' + (reglesOuvertes ? 'rotate-90' : '')}
            />
          </button>

          {reglesOuvertes && (
            <div className="cascade mt-4 space-y-3">
              {REGLES_RGI.map((r) => (
                <article key={r.numero} className="rounded-xl border bg-card p-5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Badge className="shrink-0">{r.numero}</Badge>
                    <h3 className="font-display text-sm font-bold text-foreground">{r.titre}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{r.enonce}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.usage}</p>
                  <p className="mt-2 border-t pt-2 text-xs leading-relaxed text-muted-foreground">
                    <strong className="text-foreground">Exemple : </strong>
                    {r.exemple}
                  </p>
                </article>
              ))}
              <p className="rounded-md border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                Reformulation en français courant. Le libellé qui fait foi est celui du Système
                harmonisé de l’OMD et du Tarif Extérieur Commun de l’UEMOA.
              </p>
            </div>
          )}
        </section>

        {/* ---------- L'historique récent ---------- */}
        {historique && historique.length > 0 && (
          <section className="mt-10" data-revele>
            <div className="flex items-center justify-between gap-2">
              <h2 className="trait-anime flex items-center gap-2 font-display text-base font-bold text-foreground">
                <History className="h-4 w-4 text-primary" />
                Vos dernières classifications
              </h2>
              <Link
                to="/declarant/historique"
                className="text-xs font-medium text-primary hover:underline"
              >
                Tout l’historique
              </Link>
            </div>
            <ul className="cascade mt-4 divide-y rounded-xl border bg-card">
              {historique.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{c.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(c.cree_le).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-display text-sm font-semibold tabular-nums text-foreground">
                      {c.code_propose ?? '—'}
                    </span>
                    {c.verifie_en_base ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        {c.taux_dd !== null ? `DD ${c.taux_dd} %` : 'Confirmé'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-700">
                        À vérifier
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
