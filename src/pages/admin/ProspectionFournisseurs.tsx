import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  PROSPECTION_FOURNISSEURS_TABLE,
  STATUT_PROSPECTION_LABELS,
  type ProspectionFournisseur,
  type StatutProspection,
} from '@/lib/supabase';
import AdminNav from '@/components/AdminNav';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const STATUT_BADGE_VARIANT: Record<StatutProspection, 'default' | 'secondary' | 'outline'> = {
  a_contacter: 'outline',
  contacte: 'secondary',
  partenariat_signe: 'default',
};

const PRIORITE_LABELS: Record<number, string> = {
  1: 'Priorité 1',
  2: 'Priorité 2',
  3: 'Priorité 3',
};

export default function ProspectionFournisseurs() {
  const [rows, setRows] = useState<ProspectionFournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from(PROSPECTION_FOURNISSEURS_TABLE)
        .select('*')
        .order('priorite')
        .order('nom_entreprise');
      const list = (data as ProspectionFournisseur[]) ?? [];
      setRows(list);
      setNotesDraft(Object.fromEntries(list.map((r) => [r.id, r.notes ?? ''])));
      setLoading(false);
    };
    load();
  }, []);

  const updateStatut = async (id: string, statut: StatutProspection) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, statut } : r)));
    const { error } = await supabase
      .from(PROSPECTION_FOURNISSEURS_TABLE)
      .update({ statut, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Impossible de mettre à jour le statut.');
    }
  };

  const saveNotes = async (id: string) => {
    const notes = notesDraft[id] ?? '';
    const original = rows.find((r) => r.id === id)?.notes ?? '';
    if (notes === original) return;
    const { error } = await supabase
      .from(PROSPECTION_FOURNISSEURS_TABLE)
      .update({ notes: notes.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Impossible d’enregistrer la note.');
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, notes: notes.trim() || null } : r)));
    toast.success('Note enregistrée.');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">
              Admin — Prospection fournisseurs Espace Pro
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Suivi interne du démarchage des enseignes ivoiriennes. Page réservée à l'administration —
          aucune de ces informations n'est publiée sur le site tant que le statut n'est pas
          « Partenariat signé » et qu'un accord formel n'a été trouvé.
        </p>

        {loading ? (
          <div className="mt-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucune entreprise enregistrée pour le moment.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">{r.nom_entreprise}</h3>
                      <Badge variant="outline" className="text-[10px]">
                        {PRIORITE_LABELS[r.priorite]}
                      </Badge>
                      <Badge variant={STATUT_BADGE_VARIANT[r.statut]} className="text-[10px]">
                        {STATUT_PROSPECTION_LABELS[r.statut]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.secteur}</p>
                    {r.offre && <p className="mt-1.5 text-sm text-foreground">{r.offre}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {r.adresse && <span>{r.adresse}</span>}
                      {r.contact && <span>{r.contact}</span>}
                      {r.site_web && <span>{r.site_web}</span>}
                    </div>
                  </div>

                  <select
                    value={r.statut}
                    onChange={(e) => updateStatut(r.id, e.target.value as StatutProspection)}
                    className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {(Object.keys(STATUT_PROSPECTION_LABELS) as StatutProspection[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUT_PROSPECTION_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <Textarea
                  value={notesDraft[r.id] ?? ''}
                  onChange={(e) => setNotesDraft((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  onBlur={() => saveNotes(r.id)}
                  rows={2}
                  placeholder="Notes de suivi (échanges, dates de relance, décision...)"
                  className="mt-3 text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
