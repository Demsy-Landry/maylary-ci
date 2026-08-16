import { useEffect, useState, type ChangeEvent } from 'react';
import {
  supabase,
  EDGE_FUNCTIONS_URL,
  CANAUX_PAIEMENT_TABLE,
  PREUVES_PAIEMENT_BUCKET,
  type CanalPaiement,
  type CommandeGPClient,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';

interface DeclarerPaiementProps {
  /* Le type client : ce panneau ne voit jamais le coût fournisseur. */
  commande: CommandeGPClient;
  userId: string;
  onDeclare: () => void;
}

/** Au-delà, c'est une photo pleine résolution, pas un reçu. */
const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;
const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

/**
 * Déclaration de règlement par le client.
 *
 * Le bouton « J'ai payé » basculait auparavant la commande sur simple
 * affirmation : ni référence, ni reçu, rien à confronter.
 *
 * Trois pièces sont maintenant exigées, toutes les trois. Wave comme la banque
 * fournissent la référence et le reçu ; n'en demander qu'un laissait au client
 * le choix de la pièce la plus facile à inventer. Le montant s'y ajoute parce
 * qu'un lien de paiement statique ne le fixe pas : c'est le client qui le
 * saisit, et un règlement incomplet ne se découvrait qu'à la vérification,
 * commande déjà engagée.
 *
 * La base refuse par ailleurs une référence déjà consignée sur une autre
 * commande. C'est le seul des trois contrôles qui soit un vrai verrou : les
 * deux autres rattrapent l'erreur honnête, celui-là empêche la réutilisation
 * délibérée d'un code de règlement.
 */
export default function DeclarerPaiement({ commande, userId, onDeclare }: DeclarerPaiementProps) {
  const [ouvert, setOuvert] = useState(false);
  const [canaux, setCanaux] = useState<CanalPaiement[]>([]);
  const [canal, setCanal] = useState('');
  const [reference, setReference] = useState('');
  const [montant, setMontant] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!ouvert) return;
    const load = async () => {
      const { data } = await supabase
        .from(CANAUX_PAIEMENT_TABLE)
        .select('*')
        .eq('actif', true)
        .order('ordre')
        .order('created_at');
      const liste = (data as CanalPaiement[]) ?? [];
      setCanaux(liste);
      if (liste.length > 0) setCanal((prec) => prec || liste[0].libelle);
    };
    load();
  }, [ouvert]);

  const choisirFichier = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!TYPES_ACCEPTES.includes(f.type)) {
      setErreur('Joignez une image (JPG, PNG, WEBP) ou un PDF.');
      return;
    }
    if (f.size > TAILLE_MAX_OCTETS) {
      setErreur('Ce fichier dépasse 5 Mo. Une capture d’écran suffit.');
      return;
    }
    setErreur('');
    setFichier(f);
  };

  const envoyer = async () => {
    setErreur('');
    if (!reference.trim()) {
      setErreur('La référence de votre transaction est obligatoire.');
      return;
    }
    if (!fichier) {
      setErreur('Le reçu de votre transaction est obligatoire.');
      return;
    }
    // Le montant est comparé au dû côté serveur, qui seul fait foi. Le contrôle
    // ici évite un aller-retour réseau pour une saisie manifestement vide.
    const saisi = Number(montant);
    if (!Number.isFinite(saisi) || saisi <= 0) {
      setErreur('Indiquez le montant que vous avez réglé.');
      return;
    }

    setEnvoi(true);
    let chemin: string | null = null;

    // Le reçu part d'abord : consigner la déclaration puis échouer sur le
    // dépôt laisserait une commande « payée » sans sa pièce.
    if (fichier) {
      const extension = fichier.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      // Le premier segment est l'identifiant du client : c'est ce que la RLS du
      // compartiment vérifie, côté dépôt comme côté lecture.
      chemin = `${userId}/${commande.id}-${Date.now()}.${extension}`;
      const { error: erreurDepot } = await supabase.storage
        .from(PREUVES_PAIEMENT_BUCKET)
        .upload(chemin, fichier, { contentType: fichier.type, upsert: false });
      if (erreurDepot) {
        setEnvoi(false);
        setErreur("Le reçu n'a pas pu être envoyé. Vérifiez votre connexion et réessayez.");
        return;
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const jeton = session?.access_token;
    if (!jeton) {
      setEnvoi(false);
      setErreur('Session expirée, reconnectez-vous.');
      return;
    }

    try {
      const res = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_commande_gp_marquer_paye`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({
          commande_id: commande.id,
          canal: canal || null,
          reference_transaction: reference.trim(),
          preuve_chemin: chemin,
          montant_declare: Math.round(saisi),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Une erreur est survenue.');

      toast.success('Merci ! Nous vérifions la réception de votre paiement.');
      setOuvert(false);
      setReference('');
      setMontant('');
      setFichier(null);
      onDeclare();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible de déclarer votre paiement.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <Button size="sm" className="shrink-0" onClick={() => setOuvert(true)}>
        <CheckCircle2 className="mr-1.5 h-4 w-4" />
        J'ai payé
      </Button>

      <Dialog open={ouvert} onOpenChange={(o) => !envoi && setOuvert(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Déclarer mon règlement</DialogTitle>
            <DialogDescription>
              Commande {commande.reference_publique} —{' '}
              {commande.montant_total_fcfa.toLocaleString('fr-FR')} FCFA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {canaux.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="canal-paye">Par quel compte avez-vous payé ?</Label>
                <select
                  id="canal-paye"
                  value={canal}
                  onChange={(e) => setCanal(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {canaux.map((c) => (
                    <option key={c.id} value={c.libelle}>
                      {c.libelle}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="montant-regle">Montant réglé (FCFA)</Label>
              <Input
                id="montant-regle"
                type="number"
                inputMode="numeric"
                min={0}
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder={String(commande.montant_total_fcfa)}
              />
              <p className="text-xs text-muted-foreground">
                Doit correspondre exactement aux{' '}
                <span className="font-medium text-foreground">
                  {commande.montant_total_fcfa.toLocaleString('fr-FR')} FCFA
                </span>{' '}
                dus.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref-transaction">Référence de la transaction</Label>
              <Input
                id="ref-transaction"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="ex: MP260803.1425.A12345"
              />
              <p className="text-xs text-muted-foreground">
                Le code du SMS de confirmation, ou la référence de votre virement. Chaque référence
                ne peut servir qu'une fois.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recu">Reçu de la transaction (capture d'écran ou PDF)</Label>
              {fichier ? (
                <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{fichier.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setFichier(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Input
                  id="recu"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={choisirFichier}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Votre reçu n'est visible que par vous et par notre équipe.
              </p>
            </div>

            {erreur && (
              <p className="text-sm text-destructive" role="alert">
                {erreur}
              </p>
            )}

            <Button className="w-full" onClick={envoyer} disabled={envoi}>
              {envoi && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Déclarer mon règlement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
