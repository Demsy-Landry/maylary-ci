import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  FOURNISSEURS_TABLE,
  REGIMES_ORIGINE_TABLE,
  REGIME_ORIGINE_LABELS,
  PREUVE_ORIGINE_LABELS,
  MODELE_FOURNISSEUR_LABELS,
  type Fournisseur,
  type RegimeOrigine,
  type CodeRegimeOrigine,
  type PreuveOrigine,
  type ModeleFournisseur,
  type ArbitrageOrigine,
} from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Plus, Loader2, AlertTriangle } from 'lucide-react';

/**
 * Les fournisseurs, rangés par origine plutôt que par ordre alphabétique.
 *
 * Le classement n'est pas cosmétique. Ce qui distingue deux fournisseurs du
 * même produit, ce n'est plus seulement leur prix : c'est le droit de douane
 * que leur marchandise supportera à Abidjan. Une même chemise vaut 20 % de
 * moins à l'arrivée si elle vient d'Italie avec un EUR.1 plutôt que de Chine.
 * L'écran met donc l'origine au premier plan.
 *
 * Et il signale l'incohérence la plus coûteuse : un fournisseur situé dans une
 * zone préférentielle qui ne sait pas produire la preuve d'origine. Sur le
 * papier c'est une bonne piste ; en pratique il paie le tarif plein comme
 * n'importe qui, et on l'a choisi pour un avantage qu'il n'apporte pas.
 */

const CHAMP_SELECT =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ' +
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

type Brouillon = Partial<Fournisseur> & { nom: string };

const BROUILLON_VIDE: Brouillon = {
  nom: '',
  pays: '',
  ville: '',
  secteur: '',
  modele: 'gros',
  regime_origine: 'droit_commun',
  preuve_origine: 'inconnu',
  incoterm_defaut: '',
  devise: 'EUR',
  site_web: '',
  contact: '',
  note: '',
};

const nombreOuNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
};

const fcfa = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('fr-FR')} FCFA`;

export default function Fournisseurs() {
  const [rows, setRows] = useState<Fournisseur[]>([]);
  const [regimes, setRegimes] = useState<RegimeOrigine[]>([]);
  const [loading, setLoading] = useState(true);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = async () => {
    setLoading(true);
    const [{ data: f }, { data: r }] = await Promise.all([
      supabase.from(FOURNISSEURS_TABLE).select('*').order('pays').order('nom'),
      supabase.from(REGIMES_ORIGINE_TABLE).select('*').order('ordre'),
    ]);
    setRows((f as Fournisseur[]) ?? []);
    setRegimes((r as RegimeOrigine[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void charger();
  }, []);

  const regimeDe = (code: string | null) => regimes.find((r) => r.code === code);

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    if (!brouillon || !brouillon.nom.trim()) {
      toast.error('Le nom du fournisseur est obligatoire.');
      return;
    }
    setEnregistrement(true);
    const charge = {
      nom: brouillon.nom.trim(),
      pays: brouillon.pays?.trim() || null,
      ville: brouillon.ville?.trim() || null,
      secteur: brouillon.secteur?.trim() || null,
      modele: brouillon.modele ?? 'gros',
      regime_origine: brouillon.regime_origine ?? null,
      preuve_origine: brouillon.preuve_origine ?? 'inconnu',
      incoterm_defaut: brouillon.incoterm_defaut?.trim() || null,
      devise: brouillon.devise?.trim() || 'EUR',
      delai_production_jours: nombreOuNull(brouillon.delai_production_jours),
      delai_transport_jours: nombreOuNull(brouillon.delai_transport_jours),
      minimum_commande_fcfa: nombreOuNull(brouillon.minimum_commande_fcfa),
      mode_transport: brouillon.mode_transport?.trim() || null,
      site_web: brouillon.site_web?.trim() || null,
      contact: brouillon.contact?.trim() || null,
      note: brouillon.note?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = brouillon.id
      ? await supabase.from(FOURNISSEURS_TABLE).update(charge).eq('id', brouillon.id)
      : await supabase.from(FOURNISSEURS_TABLE).insert(charge);

    setEnregistrement(false);
    if (error) {
      toast.error("Enregistrement impossible : " + error.message);
      return;
    }
    toast.success(brouillon.id ? 'Fournisseur mis à jour.' : 'Fournisseur ajouté.');
    setBrouillon(null);
    void charger();
  };

  const parPays = useMemo(() => {
    const groupes = new Map<string, Fournisseur[]>();
    for (const f of rows) {
      const cle = f.pays ?? 'Pays non renseigné';
      groupes.set(cle, [...(groupes.get(cle) ?? []), f]);
    }
    return [...groupes.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [rows]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-screen-xl px-4 py-4 sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">
              Admin — Fournisseurs et origines
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl space-y-8 px-4 py-8 sm:px-6">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Ce qui distingue deux fournisseurs du même produit n'est pas seulement leur prix, c'est le
          droit de douane que leur marchandise supportera à Abidjan. Un fournisseur situé dans une
          zone préférentielle mais incapable de produire la preuve d'origine paie le tarif plein
          comme n'importe qui — l'écran le signale.
        </p>

        <ArbitrageOrigineCarte regimes={regimes} />

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-foreground">
              Fournisseurs enregistrés
            </h2>
            <Button size="sm" onClick={() => setBrouillon({ ...BROUILLON_VIDE })}>
              <Plus className="mr-1.5 h-4 w-4" />
              Ajouter un fournisseur
            </Button>
          </div>

          {loading ? (
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aucun fournisseur enregistré.
            </p>
          ) : (
            <div className="mt-4 space-y-6">
              {parPays.map(([pays, liste]) => (
                <div key={pays}>
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    {pays}
                  </h3>
                  <div className="mt-2 space-y-3">
                    {liste.map((f) => {
                      const regime = regimeDe(f.regime_origine);
                      // L'incohérence qui coûte cher : une zone préférentielle
                      // sans preuve d'origine ne vaut pas mieux que le droit
                      // commun, et on l'a choisie en croyant le contraire.
                      const preferentielSansPreuve =
                        f.regime_origine !== null &&
                        f.regime_origine !== 'droit_commun' &&
                        f.preuve_origine === 'non';

                      return (
                        <div key={f.id} className="rounded-lg border bg-card p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-semibold text-foreground">{f.nom}</h4>
                                <Badge variant="outline" className="text-[10px]">
                                  {MODELE_FOURNISSEUR_LABELS[f.modele]}
                                </Badge>
                                {f.regime_origine && (
                                  <Badge
                                    variant={
                                      f.regime_origine === 'droit_commun' ? 'secondary' : 'default'
                                    }
                                    className="text-[10px]"
                                  >
                                    {REGIME_ORIGINE_LABELS[f.regime_origine]}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px]">
                                  Preuve : {PREUVE_ORIGINE_LABELS[f.preuve_origine]}
                                </Badge>
                              </div>
                              {f.secteur && (
                                <p className="mt-0.5 text-xs text-muted-foreground">{f.secteur}</p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBrouillon({ ...f })}
                            >
                              Modifier
                            </Button>
                          </div>

                          {preferentielSansPreuve && (
                            <p className="mt-3 flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-foreground">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                              <span>
                                Zone {REGIME_ORIGINE_LABELS[f.regime_origine!]} mais aucune preuve
                                d'origine : la marchandise paiera le tarif plein.
                                {regime?.document_requis && (
                                  <> Demander un {regime.document_requis.split(' ou ')[0]}.</>
                                )}
                              </span>
                            </p>
                          )}

                          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                            <Detail terme="Incoterm" valeur={f.incoterm_defaut} />
                            <Detail terme="Devise" valeur={f.devise} />
                            <Detail
                              terme="Délai transport"
                              valeur={f.delai_transport_jours ? `${f.delai_transport_jours} j` : null}
                            />
                            <Detail terme="Minimum" valeur={fcfa(f.minimum_commande_fcfa)} />
                          </dl>

                          {f.note && (
                            <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
                              {f.note}
                            </p>
                          )}
                          {f.site_web && (
                            <a
                              href={f.site_web}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block text-xs text-primary hover:underline"
                            >
                              {f.site_web}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {brouillon && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {brouillon.id ? `Modifier ${brouillon.nom}` : 'Nouveau fournisseur'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={enregistrer} className="grid gap-4 sm:grid-cols-2">
                <Champ label="Nom" obligatoire>
                  <Input
                    value={brouillon.nom}
                    onChange={(e) => setBrouillon({ ...brouillon, nom: e.target.value })}
                  />
                </Champ>
                <Champ label="Secteur">
                  <Input
                    value={brouillon.secteur ?? ''}
                    onChange={(e) => setBrouillon({ ...brouillon, secteur: e.target.value })}
                  />
                </Champ>
                <Champ label="Pays">
                  <Input
                    value={brouillon.pays ?? ''}
                    onChange={(e) => setBrouillon({ ...brouillon, pays: e.target.value })}
                  />
                </Champ>
                <Champ label="Ville">
                  <Input
                    value={brouillon.ville ?? ''}
                    onChange={(e) => setBrouillon({ ...brouillon, ville: e.target.value })}
                  />
                </Champ>

                <Champ label="Modèle d'achat">
                  <select
                    className={CHAMP_SELECT}
                    value={brouillon.modele ?? 'gros'}
                    onChange={(e) =>
                      setBrouillon({ ...brouillon, modele: e.target.value as ModeleFournisseur })
                    }
                  >
                    {Object.entries(MODELE_FOURNISSEUR_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Champ>

                <Champ label="Régime d'origine">
                  <select
                    className={CHAMP_SELECT}
                    value={brouillon.regime_origine ?? 'droit_commun'}
                    onChange={(e) =>
                      setBrouillon({
                        ...brouillon,
                        regime_origine: e.target.value as CodeRegimeOrigine,
                      })
                    }
                  >
                    {regimes.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.libelle}
                      </option>
                    ))}
                  </select>
                </Champ>

                <Champ label="Fournit la preuve d'origine ?">
                  <select
                    className={CHAMP_SELECT}
                    value={brouillon.preuve_origine ?? 'inconnu'}
                    onChange={(e) =>
                      setBrouillon({
                        ...brouillon,
                        preuve_origine: e.target.value as PreuveOrigine,
                      })
                    }
                  >
                    {Object.entries(PREUVE_ORIGINE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Champ>

                <Champ label="Incoterm par défaut">
                  <Input
                    placeholder="EXW, FOB, DDP…"
                    value={brouillon.incoterm_defaut ?? ''}
                    onChange={(e) =>
                      setBrouillon({ ...brouillon, incoterm_defaut: e.target.value })
                    }
                  />
                </Champ>
                <Champ label="Devise">
                  <Input
                    value={brouillon.devise ?? 'EUR'}
                    onChange={(e) => setBrouillon({ ...brouillon, devise: e.target.value })}
                  />
                </Champ>
                <Champ label="Mode de transport">
                  <Input
                    value={brouillon.mode_transport ?? ''}
                    onChange={(e) => setBrouillon({ ...brouillon, mode_transport: e.target.value })}
                  />
                </Champ>
                <Champ label="Délai de production (jours)">
                  <Input
                    type="number"
                    value={brouillon.delai_production_jours ?? ''}
                    onChange={(e) =>
                      setBrouillon({
                        ...brouillon,
                        delai_production_jours: nombreOuNull(e.target.value),
                      })
                    }
                  />
                </Champ>
                <Champ label="Délai de transport (jours)">
                  <Input
                    type="number"
                    value={brouillon.delai_transport_jours ?? ''}
                    onChange={(e) =>
                      setBrouillon({
                        ...brouillon,
                        delai_transport_jours: nombreOuNull(e.target.value),
                      })
                    }
                  />
                </Champ>
                <Champ label="Minimum de commande (FCFA)">
                  <Input
                    type="number"
                    value={brouillon.minimum_commande_fcfa ?? ''}
                    onChange={(e) =>
                      setBrouillon({
                        ...brouillon,
                        minimum_commande_fcfa: nombreOuNull(e.target.value),
                      })
                    }
                  />
                </Champ>
                <Champ label="Site web">
                  <Input
                    value={brouillon.site_web ?? ''}
                    onChange={(e) => setBrouillon({ ...brouillon, site_web: e.target.value })}
                  />
                </Champ>
                <Champ label="Contact">
                  <Input
                    value={brouillon.contact ?? ''}
                    onChange={(e) => setBrouillon({ ...brouillon, contact: e.target.value })}
                  />
                </Champ>

                <div className="sm:col-span-2">
                  <Champ label="Note">
                    <Textarea
                      rows={3}
                      value={brouillon.note ?? ''}
                      onChange={(e) => setBrouillon({ ...brouillon, note: e.target.value })}
                    />
                  </Champ>
                </div>

                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={enregistrement}>
                    {enregistrement && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setBrouillon(null)}>
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function Champ({
  label,
  obligatoire,
  children,
}: {
  label: string;
  obligatoire?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {obligatoire && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function Detail({ terme, valeur }: { terme: string; valeur: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{terme}</dt>
      <dd className="font-medium text-foreground">{valeur ?? '—'}</dd>
    </div>
  );
}

/**
 * « Certains importateurs n'ont pas le temps de faire un APE, sauf quand le
 * montant est très élevé. »
 *
 * C'est vrai, et c'est un calcul : l'économie grandit avec la valeur en douane,
 * la démarche coûte à peu près pareil quel que soit le montant. Il existe donc
 * un seuil. Le calcul vit en base — une seule place où il puisse être faux.
 */
function ArbitrageOrigineCarte({ regimes }: { regimes: RegimeOrigine[] }) {
  const [caf, setCaf] = useState('');
  const [taux, setTaux] = useState('20');
  const [cout, setCout] = useState('');
  const [delai, setDelai] = useState('');
  const [resultat, setResultat] = useState<ArbitrageOrigine | null>(null);
  const [encours, setEncours] = useState(false);

  // Un coût de démarche déjà relevé pour un régime évite de le ressaisir.
  const coutConnu = regimes.find((r) => r.cout_preuve_fcfa !== null)?.cout_preuve_fcfa ?? null;

  const calculer = async () => {
    const cafN = nombreOuNull(caf);
    const tauxN = nombreOuNull(taux);
    if (cafN === null || tauxN === null) {
      toast.error('Renseignez la valeur en douane et le taux de droit.');
      return;
    }
    setEncours(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_arbitrage_origine', {
      p_caf_fcfa: cafN,
      p_taux_dd: tauxN / 100,
      p_cout_preuve_fcfa: nombreOuNull(cout) ?? coutConnu,
      p_delai_preuve_jours: nombreOuNull(delai),
    });
    setEncours(false);
    if (error) {
      toast.error('Calcul impossible : ' + error.message);
      return;
    }
    setResultat(data as ArbitrageOrigine);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">La preuve d'origine vaut-elle la démarche ?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Obtenir un EUR.1 ou un certificat d'origine prend du temps et coûte à peu près le même
          prix quel que soit le montant importé. L'économie, elle, grandit avec la valeur en douane.
          Il existe donc un seuil en dessous duquel la démarche fait perdre plus qu'elle ne
          rapporte — et c'est ce seuil qu'un client ne sait pas calculer seul.
        </p>

        <div className="grid gap-3 sm:grid-cols-4">
          <Champ label="Valeur en douane CAF (FCFA)">
            <Input type="number" value={caf} onChange={(e) => setCaf(e.target.value)} />
          </Champ>
          <Champ label="Taux de droit (%)">
            <Input type="number" value={taux} onChange={(e) => setTaux(e.target.value)} />
          </Champ>
          <Champ label="Coût de la preuve (FCFA)">
            <Input
              type="number"
              placeholder={coutConnu !== null ? String(coutConnu) : 'à renseigner'}
              value={cout}
              onChange={(e) => setCout(e.target.value)}
            />
          </Champ>
          <Champ label="Délai ajouté (jours)">
            <Input type="number" value={delai} onChange={(e) => setDelai(e.target.value)} />
          </Champ>
        </div>

        <Button size="sm" onClick={() => void calculer()} disabled={encours}>
          {encours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Calculer
        </Button>

        {resultat && (
          <div
            className={
              'rounded-md border p-3 text-sm ' +
              (resultat.verdict === 'vaut_la_peine'
                ? 'border-primary/40 bg-primary/5'
                : 'border-muted bg-muted/40')
            }
          >
            <p className="text-foreground">{resultat.message ?? resultat.motif}</p>
            {resultat.seuil_rentabilite_caf_fcfa !== undefined && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Seuil de rentabilité : {fcfa(resultat.seuil_rentabilite_caf_fcfa)} de valeur en
                douane.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
