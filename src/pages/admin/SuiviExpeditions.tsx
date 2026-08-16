import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AdminNav from '@/components/AdminNav';
import FriseSuivi from '@/components/FriseSuivi';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  EXPEDITIONS_TABLE,
  PROFILES_TABLE,
  ETAPES_EXPEDITION,
  STATUT_EXPEDITION_LABELS,
  MODE_EXPEDITION_LABELS,
  type Expedition,
  type ModeExpedition,
  type Profile,
} from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, RefreshCw, Radio, Save, PackageSearch } from 'lucide-react';

/**
 * Le suivi des expéditions, côté maison.
 *
 * DEUX GESTES, ET LE SECOND EST LE PLUS IMPORTANT
 *
 * « Relever chez le transporteur » ne vaut que pour un colis qui a un numéro
 * de suivi — le petit express. Pour un conteneur en groupage, aucune API ne
 * dira « empoté à Nansha » : c'est MayLary qui le sait, puisque c'est MayLary
 * qui l'a réservé. « Noter une étape » n'est donc pas un pis-aller, c'est le
 * geste principal sur la majorité des dossiers.
 *
 * Les deux alimentent la MÊME frise, celle que le client voit, chacun sous son
 * nom.
 */

const selectClassName =
  'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm';

const quand = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export default function SuiviExpeditions() {
  const [expeditions, setExpeditions] = useState<Expedition[] | null>(null);
  const [profils, setProfils] = useState<Record<string, Profile>>({});
  const [ouverte, setOuverte] = useState<Expedition | null>(null);
  const [rafraichir, setRafraichir] = useState(0);
  const [occupe, setOccupe] = useState(false);

  // Création
  const [creation, setCreation] = useState(false);
  const [nouvelle, setNouvelle] = useState({ designation: '', mode: 'maritime' as ModeExpedition });

  // Édition du transporteur
  const [transporteur, setTransporteur] = useState('');
  const [transporteurCode, setTransporteurCode] = useState('');
  const [numeroSuivi, setNumeroSuivi] = useState('');

  // Nouvelle étape
  const [etape, setEtape] = useState({ libelle: '', lieu: '', statut: '' });

  const charger = async () => {
    const { data } = await supabase
      .from(EXPEDITIONS_TABLE)
      .select('*')
      .order('maj_le', { ascending: false });
    const liste = (data as Expedition[]) ?? [];
    setExpeditions(liste);

    const ids = [...new Set(liste.map((e) => e.user_id).filter(Boolean))] as string[];
    if (ids.length > 0) {
      const { data: p } = await supabase.from(PROFILES_TABLE).select('*').in('user_id', ids);
      const carte: Record<string, Profile> = {};
      for (const x of (p as Profile[]) ?? []) carte[x.user_id] = x;
      setProfils(carte);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const ouvrir = (e: Expedition) => {
    setOuverte(e);
    setTransporteur(e.transporteur ?? '');
    setTransporteurCode(e.transporteur_code ?? '');
    setNumeroSuivi(e.numero_suivi ?? '');
    setEtape({ libelle: '', lieu: '', statut: '' });
  };

  const client = (id: string | null) =>
    id ? (profils[id]?.nom_entreprise || profils[id]?.nom_complet || '—') : 'interne';

  const creerExpedition = async () => {
    setOccupe(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_ouvrir_expedition', {
      p_origine_type: 'libre',
      p_origine_id: crypto.randomUUID(),
      p_user_id: null,
      p_designation: nouvelle.designation.trim() || null,
      p_mode: nouvelle.mode,
    });
    setOccupe(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Expédition ${(data as { numero: string }).numero} ouverte.`);
    setCreation(false);
    setNouvelle({ designation: '', mode: 'maritime' });
    charger();
  };

  const enregistrerTransporteur = async () => {
    if (!ouverte) return;
    setOccupe(true);
    const { error } = await supabase
      .from(EXPEDITIONS_TABLE)
      .update({
        transporteur: transporteur.trim() || null,
        transporteur_code: transporteurCode.trim() || null,
        numero_suivi: numeroSuivi.trim() || null,
        maj_le: new Date().toISOString(),
      })
      .eq('id', ouverte.id);
    setOccupe(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Transporteur enregistré.');
    await charger();
    setRafraichir((n) => n + 1);
  };

  const noterEtape = async () => {
    if (!ouverte) return;
    if (etape.libelle.trim().length < 3) {
      toast.error('Décrivez l’étape — c’est ce que le client lira.');
      return;
    }
    setOccupe(true);
    const { error } = await supabase.rpc('app_e08c374bc4_noter_etape', {
      p_expedition_id: ouverte.id,
      p_libelle: etape.libelle.trim(),
      p_lieu: etape.lieu.trim() || null,
      p_survenu_le: null,
      p_statut: etape.statut || null,
    });
    setOccupe(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Étape notée. Le client la voit.');
    setEtape({ libelle: '', lieu: '', statut: '' });
    await charger();
    setRafraichir((n) => n + 1);
  };

  /** La relève chez le transporteur. Ne vaut que pour un numéro de suivi. */
  const relever = async (cible?: Expedition) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error('Session expirée.');
      return;
    }
    setOccupe(true);
    try {
      const r = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_suivi_relever`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(cible ? { expedition_id: cible.id } : { limite: 20 }),
      });
      const corps = await r.json();
      if (!r.ok) {
        /* Le cas « pas de clé » mérite mieux qu'un message d'erreur générique :
         * c'est une action du fondateur, pas une panne. */
        toast.error(corps?.erreur ?? 'La relève a échoué.', { duration: 9000 });
        return;
      }
      const n = corps.nouveaux_evenements ?? 0;
      toast.success(
        n > 0
          ? `${n} nouvelle${n > 1 ? 's' : ''} étape${n > 1 ? 's' : ''} relevée${n > 1 ? 's' : ''}.`
          : 'Relève effectuée — aucune nouvelle étape chez le transporteur.',
      );
      await charger();
      setRafraichir((x) => x + 1);
    } catch {
      toast.error('Le service de relève est injoignable.');
    } finally {
      setOccupe(false);
    }
  };

  const enCours = (expeditions ?? []).filter((e) => e.statut !== 'livree' && e.statut !== 'annulee');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:px-6">
          <AdminNav />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-lg font-bold text-foreground">
              Admin — Suivi des expéditions
            </h1>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => relever()} disabled={occupe}>
                {occupe ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                )}
                Relever chez les transporteurs
              </Button>
              <Button size="sm" onClick={() => setCreation(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nouvelle expédition
              </Button>
            </div>
          </div>
          {enCours.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {enCours.length} expédition{enCours.length > 1 ? 's' : ''} en cours
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        {expeditions === null ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : expeditions.length === 0 ? (
          <div className="rounded-md border border-dashed p-10 text-center">
            <PackageSearch className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">Aucune expédition suivie.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ouvrez-en une dès qu’une marchandise part : le client la voit aussitôt.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {expeditions.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => ouvrir(e)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">
                    {e.numero}
                    {e.designation ? ` — ${e.designation}` : ''}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {client(e.user_id)} · {MODE_EXPEDITION_LABELS[e.mode]}
                    {e.transporteur ? ` · ${e.transporteur}` : ''}
                    {e.numero_suivi ? ` · ${e.numero_suivi}` : ' · sans numéro de suivi'}
                    {' · relevé '}
                    {quand(e.derniere_reponse_le)}
                  </span>
                </span>
                <Badge variant={e.statut === 'incident' ? 'destructive' : 'secondary'}>
                  {STATUT_EXPEDITION_LABELS[e.statut]}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* ---------- Création ---------- */}
      <Dialog open={creation} onOpenChange={(o) => !o && setCreation(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle expédition</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Désignation</Label>
              <Input
                value={nouvelle.designation}
                onChange={(ev) => setNouvelle((n) => ({ ...n, designation: ev.target.value }))}
                placeholder="Conteneur carreaux — Foshan"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mode</Label>
              <select
                className={selectClassName}
                value={nouvelle.mode}
                onChange={(ev) => setNouvelle((n) => ({ ...n, mode: ev.target.value as ModeExpedition }))}
              >
                {(Object.keys(MODE_EXPEDITION_LABELS) as ModeExpedition[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_EXPEDITION_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={creerExpedition} disabled={occupe} className="w-full">
              {occupe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ouvrir l’expédition
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Gestion d'une expédition ---------- */}
      <Dialog open={!!ouverte} onOpenChange={(o) => !o && setOuverte(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{ouverte?.numero}</DialogTitle>
          </DialogHeader>
          {ouverte && (
            <div className="space-y-5">
              <div className="rounded-md border p-3">
                <FriseSuivi expedition={ouverte} cle={rafraichir} />
              </div>

              {/* Noter une étape : le geste principal sur un groupage. */}
              <div className="space-y-2 rounded-md border border-primary/30 bg-primary/[0.03] p-3">
                <p className="text-sm font-medium text-foreground">Noter une étape</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Ce que vous constatez et qu’aucune API ne dira : empotage, départ du navire,
                  arrivée au port, mainlevée, enlèvement.
                </p>
                <Input
                  value={etape.libelle}
                  onChange={(ev) => setEtape((s) => ({ ...s, libelle: ev.target.value }))}
                  placeholder="Conteneur empoté et scellé"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={etape.lieu}
                    onChange={(ev) => setEtape((s) => ({ ...s, lieu: ev.target.value }))}
                    placeholder="Lieu — Nansha, Chine"
                  />
                  <select
                    className={selectClassName}
                    value={etape.statut}
                    onChange={(ev) => setEtape((s) => ({ ...s, statut: ev.target.value }))}
                  >
                    <option value="">Ne pas changer le statut</option>
                    {ETAPES_EXPEDITION.map((s) => (
                      <option key={s.code} value={s.code}>
                        Passer à « {s.libelle} »
                      </option>
                    ))}
                    <option value="incident">Signaler un incident</option>
                  </select>
                </div>
                <Button size="sm" onClick={noterEtape} disabled={occupe}>
                  {occupe ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-1.5 h-4 w-4" />
                  )}
                  Noter l’étape
                </Button>
              </div>

              {/* Le transporteur et son numéro : c'est ce qui rend la relève possible. */}
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium text-foreground">Transporteur et numéro de suivi</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    value={transporteur}
                    onChange={(ev) => setTransporteur(ev.target.value)}
                    placeholder="DHL Express"
                  />
                  <Input
                    value={transporteurCode}
                    onChange={(ev) => setTransporteurCode(ev.target.value)}
                    placeholder="Code agrégateur (option)"
                  />
                  <Input
                    value={numeroSuivi}
                    onChange={(ev) => setNumeroSuivi(ev.target.value)}
                    placeholder="Numéro de suivi"
                    className="font-mono"
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Sans numéro de suivi, la relève automatique ne s’applique pas — c’est le cas normal
                  d’un groupage. Notez alors les étapes à la main, ci-dessus.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={enregistrerTransporteur} disabled={occupe}>
                    <Save className="mr-1.5 h-4 w-4" />
                    Enregistrer
                  </Button>
                  {ouverte.numero_suivi && (
                    <Button size="sm" variant="outline" onClick={() => relever(ouverte)} disabled={occupe}>
                      <Radio className="mr-1.5 h-4 w-4" />
                      Relever maintenant
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
