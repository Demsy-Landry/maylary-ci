import { useCallback, useEffect, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import {
  supabase,
  DOSSIERS_TABLE,
  DOSSIER_PIECES_TABLE,
  STATUTS_DOSSIER,
  MOMENTS_DOCUMENT,
  type Dossier,
  type EtatDossier,
  type StatutDossier,
  type StatutPiece,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  FolderOpen,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Archive,
  Plane,
  Ship,
  Loader2,
  FileText,
  Plus,
} from 'lucide-react';

/**
 * Les dossiers, et la seule question qui compte : qu'est-ce qui manque ?
 *
 * Le fondateur : « La documentation est la plus importante. Si un détail est
 * oublié ou négligé, toute la procédure peut prendre un coup véritable. »
 *
 * Cet écran est construit autour de cette phrase. Il ne montre pas d'abord ce
 * qui est fait — il montre ce qui manque, et ce que chaque manque coûtera. Un
 * tableau de pièces cochées rassure ; une liste de ce qui bloque fait agir.
 *
 * Trois choses sont volontairement mises en avant :
 *
 *  - **La conséquence de l'oubli**, écrite sous chaque pièce absente. « Il
 *    manque le BSC » ne dit rien à qui découvre le métier ; « pris après
 *    l'embarquement, il coûte une pénalité » fait décrocher le téléphone.
 *  - **Le moment**, parce qu'une pièce a une fenêtre. Le certificat d'origine
 *    demandé après le dédouanement ne sert plus à rien.
 *  - **Ce qui n'est pas vérifié.** Les fiches confirmées par une source
 *    officielle et celles qui attendent la confirmation du fondateur ne
 *    s'affichent pas sur le même ton. Présenter les deux comme certaines
 *    serait la façon la plus rapide de perdre la confiance de celui qui s'en
 *    sert.
 */

const ICONE_MODE: Record<string, typeof Plane> = { aerien: Plane, maritime: Ship };

const COULEUR_STATUT: Record<StatutDossier, string> = {
  ouvert: 'border-primary/50 text-primary-emphasis',
  documentation: 'border-amber-500/50 text-amber-700',
  declaration: 'border-sky-500/50 text-sky-700',
  liquidation: 'border-sky-500/50 text-sky-700',
  enlevement: 'border-violet-500/50 text-violet-700',
  livraison: 'border-emerald-500/50 text-emerald-700',
  clos: 'border-emerald-600/60 text-emerald-800',
  archive: 'border-muted-foreground/40 text-muted-foreground',
};

const LIBELLE_PIECE: Record<StatutPiece, string> = {
  attendu: 'Attendue',
  demande: 'Demandée',
  recu: 'Reçue',
  valide: 'Validée',
  sans_objet: 'Sans objet',
};

export default function DossiersGestion() {
  const [dossiers, setDossiers] = useState<Dossier[] | null>(null);
  const [ouvert, setOuvert] = useState<EtatDossier | null>(null);
  const [busy, setBusy] = useState(false);
  const [filtre, setFiltre] = useState<'actifs' | 'tous' | 'archives'>('actifs');

  // Formulaire d'ouverture manuelle : un dossier peut naître d'un appel
  // téléphonique, avant même qu'une demande existe dans l'application.
  const [nouveau, setNouveau] = useState({ sens: 'import', mode: 'aerien', designation: '' });
  const [conditions, setConditions] = useState<string[]>([]);

  const charger = useCallback(async () => {
    setDossiers(null);
    let q = supabase.from(DOSSIERS_TABLE).select('*').order('ouvert_le', { ascending: false });
    if (filtre === 'actifs') q = q.not('statut', 'in', '("clos","archive")');
    if (filtre === 'archives') q = q.eq('statut', 'archive');
    const { data, error } = await q;
    if (error) toast.error('Lecture impossible : ' + error.message);
    setDossiers((data as Dossier[]) ?? []);
  }, [filtre]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const ouvrirFiche = async (id: string) => {
    const { data, error } = await supabase.rpc('app_e08c374bc4_etat_dossier', { p_dossier_id: id });
    if (error) return toast.error(error.message);
    setOuvert(data as EtatDossier);
  };

  const creer = async () => {
    if (nouveau.designation.trim().length < 3) {
      return toast.error('Décrivez la marchandise en quelques mots.');
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_ouvrir_dossier', {
      p_sens: nouveau.sens,
      p_mode: nouveau.mode,
      p_origine_type: 'manuel',
      p_designation: nouveau.designation.trim(),
      p_conditions: conditions,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as { numero: string; pieces_attendues: number };
    toast.success(`${r.numero} ouvert — ${r.pieces_attendues} pièces attendues.`);
    setNouveau({ sens: 'import', mode: 'aerien', designation: '' });
    setConditions([]);
    void charger();
  };

  const majPiece = async (code: string, statut: StatutPiece) => {
    if (!ouvert) return;
    // « Sans objet » exige un motif — une contrainte de base le vérifie aussi,
    // mais autant l'expliquer ici plutôt que de laisser remonter une erreur SQL.
    let motif: string | null = null;
    if (statut === 'sans_objet') {
      motif = window.prompt('Pourquoi cette pièce ne s’applique-t-elle pas à ce dossier ?')?.trim() || null;
      if (!motif) return toast.error('Un motif est exigé : écarter une pièce sans dire pourquoi recrée l’oubli.');
    }
    setBusy(true);
    const { error } = await supabase
      .from(DOSSIER_PIECES_TABLE)
      .update({
        statut,
        motif_sans_objet: motif,
        recu_le: statut === 'recu' || statut === 'valide' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('dossier_id', ouvert.dossier.id)
      .eq('code_document', code);
    setBusy(false);
    if (error) return toast.error(error.message);
    void ouvrirFiche(ouvert.dossier.id);
  };

  const avancer = async (statut: StatutDossier) => {
    if (!ouvert) return;
    setBusy(true);
    const { error } = await supabase
      .from(DOSSIERS_TABLE)
      .update({ statut, updated_at: new Date().toISOString() })
      .eq('id', ouvert.dossier.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    void ouvrirFiche(ouvert.dossier.id);
    void charger();
  };

  const clore = async () => {
    if (!ouvert) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_clore_dossier', {
      p_dossier_id: ouvert.dossier.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as { clos: boolean; message: string };
    r.clos ? toast.success(r.message) : toast.error(r.message);
    void ouvrirFiche(ouvert.dossier.id);
    void charger();
  };

  const archiver = async () => {
    if (!ouvert) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_archiver_dossier', {
      p_dossier_id: ouvert.dossier.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as { archive: boolean; message: string };
    r.archive ? toast.success(r.message) : toast.error(r.message);
    void ouvrirFiche(ouvert.dossier.id);
    void charger();
  };

  const basculer = (c: string) =>
    setConditions((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-4 sm:px-6">
          <AdminNav />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="trait-anime font-display text-lg font-bold text-foreground">
              Admin — Dossiers de transit
            </h1>
            <div className="flex gap-1.5">
              {(['actifs', 'tous', 'archives'] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filtre === f ? 'default' : 'outline'}
                  className="bouton-anime"
                  onClick={() => setFiltre(f)}
                >
                  {f === 'actifs' ? 'En cours' : f === 'tous' ? 'Tous' : 'Archivés'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="entree-page mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        {/* ---------- Ouvrir un dossier ---------- */}
        <section className="carte-reactive rounded-xl border bg-card p-4 sm:p-5" data-revele>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <Plus className="h-4 w-4 text-primary" />
            Ouvrir un dossier
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Les pièces attendues ne se saisissent pas : elles sont déduites du sens, du mode et de
            ce que vous cochez ci-dessous.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="sens">Sens</Label>
              <select
                id="sens"
                value={nouveau.sens}
                onChange={(e) => setNouveau((v) => ({ ...v, sens: e.target.value }))}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="import">Import</option>
                <option value="export">Export</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mode">Mode</Label>
              <select
                id="mode"
                value={nouveau.mode}
                onChange={(e) => setNouveau((v) => ({ ...v, mode: e.target.value }))}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="aerien">Aérien</option>
                <option value="maritime">Maritime</option>
                <option value="routier">Routier</option>
                <option value="tous">Non déterminé</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="designation">Marchandise</Label>
              <Input
                id="designation"
                value={nouveau.designation}
                onChange={(e) => setNouveau((v) => ({ ...v, designation: e.target.value }))}
                placeholder="ex : 400 cartons de carrelage 60×60"
              />
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ce qui déclenche des pièces supplémentaires
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { c: 'fob_1m', l: 'Valeur FOB ≥ 1 000 000 FCFA', d: 'déclenche le RFCV' },
                { c: 'preferentiel', l: 'Origine préférentielle', d: 'certificat d’origine' },
                { c: 'supports_son_image', l: 'Supports son ou image', d: 'autorisation BURIDA' },
                { c: 'vegetaux', l: 'Végétaux ou bois', d: 'certificat phytosanitaire' },
                { c: 'denrees', l: 'Denrées alimentaires', d: 'certificat sanitaire' },
                { c: 'filiere_reglementee', l: 'Filière réglementée', d: 'agrément exportateur' },
              ].map((o) => (
                <button
                  key={o.c}
                  type="button"
                  onClick={() => basculer(o.c)}
                  title={o.d}
                  className={`bouton-anime rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    conditions.includes(o.c)
                      ? 'border-primary bg-primary/10 text-primary-emphasis'
                      : 'text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </fieldset>

          <Button onClick={creer} disabled={busy} className="bouton-anime mt-4">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderOpen className="mr-2 h-4 w-4" />}
            Ouvrir le dossier
          </Button>
        </section>

        {/* ---------- La liste ---------- */}
        <section className="mt-8">
          <h2 className="trait-anime font-display text-base font-bold text-foreground">
            {filtre === 'archives' ? 'Dossiers archivés' : filtre === 'tous' ? 'Tous les dossiers' : 'Dossiers en cours'}
          </h2>

          {dossiers === null ? (
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : dossiers.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aucun dossier {filtre === 'archives' ? 'archivé' : 'en cours'}. Chaque demande d’import
              ou d’export en ouvrira un.
            </p>
          ) : (
            <div className="cascade mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dossiers.map((d) => {
                const Icone = ICONE_MODE[d.mode] ?? FileText;
                return (
                  <button
                    key={d.id}
                    onClick={() => void ouvrirFiche(d.id)}
                    className="carte-reactive reflet rounded-xl border bg-card p-4 text-left hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-sm font-bold tabular-nums text-foreground">
                        {d.numero}
                      </span>
                      <Badge variant="outline" className={COULEUR_STATUT[d.statut]}>
                        {STATUTS_DOSSIER.find((s) => s.code === d.statut)?.libelle ?? d.statut}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-foreground">
                      {d.designation ?? 'Sans désignation'}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icone className="h-3.5 w-3.5" />
                      {d.sens === 'import' ? 'Import' : 'Export'} · {d.mode} ·{' '}
                      {new Date(d.ouvert_le).toLocaleDateString('fr-FR')}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ---------- La fiche ---------- */}
      {ouvert && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/60 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-6 sm:pb-6"
          onClick={() => setOuvert(null)}
        >
          <div
            className="animate-apparition-bas max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-xl border bg-background p-5 sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold tabular-nums text-foreground">
                  {ouvert.dossier.numero}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {ouvert.dossier.designation ?? 'Sans désignation'}
                </p>
              </div>
              <Badge variant="outline" className={COULEUR_STATUT[ouvert.dossier.statut]}>
                {STATUTS_DOSSIER.find((s) => s.code === ouvert.dossier.statut)?.libelle}
              </Badge>
            </div>

            {/* Ce qui manque, en tête. C'est la question du métier. */}
            {ouvert.complet ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-600/40 bg-emerald-50/60 p-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Toutes les pièces obligatoires sont au dossier. Il peut être clos.</span>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-50/60 p-3 text-sm text-amber-900">
                <p className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  {ouvert.manquantes.length} pièce{ouvert.manquantes.length > 1 ? 's' : ''} obligatoire
                  {ouvert.manquantes.length > 1 ? 's' : ''} manquante
                  {ouvert.manquantes.length > 1 ? 's' : ''}
                </p>
                <p className="mt-1 text-xs leading-relaxed">{ouvert.manquantes.join(' · ')}</p>
              </div>
            )}

            <div className="mt-5 space-y-2">
              {ouvert.pieces.map((p) => {
                const absente = p.statut !== 'recu' && p.statut !== 'valide' && p.statut !== 'sans_objet';
                return (
                  <div
                    key={p.code}
                    className={`rounded-lg border p-3 ${
                      absente && p.obligation === 'obligatoire' ? 'border-amber-500/40 bg-amber-50/30' : 'bg-card'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {p.libelle}
                          {p.sigle && <span className="ml-1.5 text-xs text-muted-foreground">({p.sigle})</span>}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {MOMENTS_DOCUMENT[p.moment] ?? p.moment}
                          {p.emetteur ? ` · ${p.emetteur}` : ''}
                          {p.cout_fcfa ? ` · ${p.cout_fcfa.toLocaleString('fr-FR')} FCFA` : ''}
                          {p.delai_indicatif ? ` · ${p.delai_indicatif}` : ''}
                        </p>
                        {p.obligation === 'conditionnel' && p.condition && (
                          <p className="mt-1 text-xs italic text-muted-foreground">{p.condition}</p>
                        )}
                        {/* La conséquence n'est montrée que quand la pièce manque :
                            affichée partout, elle deviendrait du décor. */}
                        {absente && p.consequence_oubli && (
                          <p className="mt-1.5 text-xs leading-relaxed text-amber-800">
                            {p.consequence_oubli}
                          </p>
                        )}
                        {p.statut === 'sans_objet' && p.motif_sans_objet && (
                          <p className="mt-1 text-xs text-muted-foreground">Écartée : {p.motif_sans_objet}</p>
                        )}
                        {!p.verifie && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            ⚠ Fiche non confirmée — à valider avant de s’en prévaloir devant un client.
                          </p>
                        )}
                      </div>
                      <Badge variant={absente ? 'outline' : 'secondary'} className="shrink-0 text-[11px]">
                        {LIBELLE_PIECE[p.statut]}
                      </Badge>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {(['demande', 'recu', 'valide', 'sans_objet'] as StatutPiece[]).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={p.statut === s ? 'default' : 'outline'}
                          disabled={busy}
                          className="bouton-anime h-7 text-xs"
                          onClick={() => void majPiece(p.code, s)}
                        >
                          {LIBELLE_PIECE[s]}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Étape
              </span>
              {STATUTS_DOSSIER.filter((s) => s.code !== 'clos' && s.code !== 'archive').map((s) => (
                <Button
                  key={s.code}
                  size="sm"
                  variant={ouvert.dossier.statut === s.code ? 'default' : 'outline'}
                  disabled={busy}
                  className="bouton-anime h-7 text-xs"
                  onClick={() => void avancer(s.code)}
                >
                  {s.libelle}
                </Button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={clore} disabled={busy} className="bouton-anime">
                <Clock className="mr-2 h-4 w-4" />
                Clore le dossier
              </Button>
              <Button onClick={archiver} disabled={busy} variant="outline" className="bouton-anime">
                <Archive className="mr-2 h-4 w-4" />
                Archiver
              </Button>
              <Button variant="ghost" onClick={() => setOuvert(null)} className="ml-auto">
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
