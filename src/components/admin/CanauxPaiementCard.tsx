import { useEffect, useState } from 'react';
import {
  supabase,
  CANAUX_PAIEMENT_TABLE,
  TYPE_CANAL_LABELS,
  type CanalPaiement,
  type TypeCanalPaiement,
} from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, Loader2, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Brouillon {
  type_canal: TypeCanalPaiement;
  libelle: string;
  numero: string;
  titulaire: string;
  instructions: string;
}

const BROUILLON_VIDE: Brouillon = {
  type_canal: 'mobile_money',
  libelle: '',
  numero: '',
  titulaire: '',
  instructions: '',
};

/**
 * Où les clients règlent leurs commandes.
 *
 * Cet écran n'existait pas. La table des coordonnées de paiement était vide, et
 * rien ne permettait de la remplir : un client qui validait sa commande lisait
 * « effectuez le règlement selon les instructions ci-dessous » sans qu'aucune
 * instruction ne suive. Tant qu'aucun canal actif n'est enregistré ici, la
 * boutique ne peut pas encaisser — l'avertissement en tête le dit sans détour.
 */
export default function CanauxPaiementCard() {
  const [canaux, setCanaux] = useState<CanalPaiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [brouillon, setBrouillon] = useState<Brouillon>(BROUILLON_VIDE);
  const [ajout, setAjout] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const charger = async () => {
    setLoading(true);
    const { data } = await supabase
      .from(CANAUX_PAIEMENT_TABLE)
      .select('*')
      .order('ordre')
      .order('created_at');
    setCanaux((data as CanalPaiement[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    charger();
  }, []);

  const ajouter = async () => {
    const estLien = brouillon.type_canal === 'lien_paiement';
    if (!brouillon.libelle.trim() || !brouillon.numero.trim()) {
      toast.info(estLien ? 'Le nom et l’adresse du lien sont indispensables.' : 'Le nom du canal et le numéro sont indispensables.');
      return;
    }
    // Un lien de paiement en clair exposerait le client sur un réseau public.
    if (estLien && !/^https:\/\//i.test(brouillon.numero.trim())) {
      toast.info('L’adresse du lien doit commencer par https://');
      return;
    }
    if (!estLien && !brouillon.titulaire.trim()) {
      toast.info('Le titulaire du compte est indispensable.');
      return;
    }
    setAjout(true);
    const { error } = await supabase.from(CANAUX_PAIEMENT_TABLE).insert({
      type_canal: brouillon.type_canal,
      libelle: brouillon.libelle.trim(),
      numero: brouillon.numero.trim(),
      titulaire: brouillon.titulaire.trim() || null,
      instructions: brouillon.instructions.trim() || null,
      ordre: canaux.length,
    });
    setAjout(false);
    if (error) {
      toast.error("Ce canal n'a pas pu être enregistré.");
      return;
    }
    setBrouillon(BROUILLON_VIDE);
    toast.success('Canal enregistré.');
    await charger();
  };

  const basculer = async (canal: CanalPaiement) => {
    setBusy(canal.id);
    await supabase
      .from(CANAUX_PAIEMENT_TABLE)
      .update({ actif: !canal.actif, updated_at: new Date().toISOString() })
      .eq('id', canal.id);
    setBusy(null);
    await charger();
  };

  const supprimer = async (canal: CanalPaiement) => {
    setBusy(canal.id);
    await supabase.from(CANAUX_PAIEMENT_TABLE).delete().eq('id', canal.id);
    setBusy(null);
    toast.success('Canal retiré.');
    await charger();
  };

  const actifs = canaux.filter((c) => c.actif).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <CardTitle>Où les clients vous paient</CardTitle>
        </div>
        <CardDescription>
          Ces coordonnées s'affichent au client dès sa commande validée. Elles ne sont visibles que
          par les comptes connectés.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Sans canal actif, la boutique prend des commandes qu'elle ne peut pas
            encaisser. Le dire ici, en tête, plutôt que de le découvrir sur une
            commande perdue. */}
        {!loading && actifs === 0 && (
          <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-foreground">
              Aucun canal actif. Vos clients peuvent commander, mais ils n'ont aucun moyen de savoir
              où payer. Ajoutez au moins un numéro Mobile Money ou un compte bancaire.
            </p>
          </div>
        )}

        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          canaux.length > 0 && (
            <div className="divide-y rounded-md border">
              {canaux.map((c) => (
                <div key={c.id} className="flex flex-wrap items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                      <span className="break-words">{c.libelle}</span>
                      <Badge variant="outline" className="shrink-0">
                        {TYPE_CANAL_LABELS[c.type_canal]}
                      </Badge>
                      {!c.actif && (
                        <Badge variant="secondary" className="shrink-0">
                          masqué
                        </Badge>
                      )}
                    </p>
                    <p className="break-words text-sm text-muted-foreground">
                      {c.numero}
                      {c.titulaire ? ` — ${c.titulaire}` : ''}
                    </p>
                    {c.instructions && (
                      <p className="mt-1 break-words text-xs italic text-muted-foreground">
                        {c.instructions}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => basculer(c)}
                      disabled={busy === c.id}
                    >
                      {c.actif ? 'Masquer' : 'Afficher'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => supprimer(c)}
                      disabled={busy === c.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium text-foreground">Ajouter un canal</p>

          {/* Ce que ce canal ne fait pas doit être dit ici, pas découvert sur
              une commande mal réglée. */}
          {brouillon.type_canal === 'lien_paiement' && (
            <p className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
              Un lien de paiement marchand ne porte ni le montant ni la référence de commande : le
              client saisit lui-même la somme, et aucune confirmation ne revient automatiquement.
              La vérification du règlement reste manuelle.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="type-canal">Type</Label>
              <select
                id="type-canal"
                value={brouillon.type_canal}
                onChange={(e) =>
                  setBrouillon((b) => ({ ...b, type_canal: e.target.value as TypeCanalPaiement }))
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(TYPE_CANAL_LABELS).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="libelle-canal">Nom affiché au client</Label>
              <Input
                id="libelle-canal"
                value={brouillon.libelle}
                onChange={(e) => setBrouillon((b) => ({ ...b, libelle: e.target.value }))}
                placeholder={
                  brouillon.type_canal === 'virement'
                    ? 'ex: Ecobank'
                    : brouillon.type_canal === 'lien_paiement'
                      ? 'ex: Payer avec Wave'
                      : 'ex: Wave'
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numero-canal">
                {brouillon.type_canal === 'virement'
                  ? 'IBAN ou RIB'
                  : brouillon.type_canal === 'lien_paiement'
                    ? 'Adresse du lien de paiement'
                    : 'Numéro marchand'}
              </Label>
              <Input
                id="numero-canal"
                value={brouillon.numero}
                onChange={(e) => setBrouillon((b) => ({ ...b, numero: e.target.value }))}
                placeholder={
                  brouillon.type_canal === 'virement'
                    ? 'CI93 CI...'
                    : brouillon.type_canal === 'lien_paiement'
                      ? 'https://pay.wave.com/m/...'
                      : '+225 07 ...'
                }
              />
            </div>

            {/* Sans objet pour un lien : c'est la page du marchand qui affiche
                son propre nom au client. */}
            {brouillon.type_canal !== 'lien_paiement' && (
              <div className="space-y-1.5">
                <Label htmlFor="titulaire-canal">Titulaire du compte</Label>
                <Input
                  id="titulaire-canal"
                  value={brouillon.titulaire}
                  onChange={(e) => setBrouillon((b) => ({ ...b, titulaire: e.target.value }))}
                  placeholder="ex: Dems'Inc"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instructions-canal">Précision pour le client (optionnel)</Label>
            <Textarea
              id="instructions-canal"
              value={brouillon.instructions}
              onChange={(e) => setBrouillon((b) => ({ ...b, instructions: e.target.value }))}
              rows={2}
              placeholder="ex: indiquez la référence de votre commande dans le motif du transfert"
            />
          </div>

          <Button onClick={ajouter} disabled={ajout}>
            {ajout ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
