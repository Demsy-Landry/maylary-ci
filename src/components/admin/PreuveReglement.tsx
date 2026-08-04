import { useEffect, useState } from 'react';
import { supabase, PREUVES_PAIEMENT_BUCKET, type CommandeGP } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Paperclip, ReceiptText, TriangleAlert } from 'lucide-react';

interface PreuveReglementProps {
  commande: CommandeGP;
  /** Montant réellement reçu, tenu par l'écran de gestion pour la confirmation. */
  montantRecu: string;
  onMontantRecu: (valeur: string) => void;
}

/**
 * Ce que le client a déclaré, mis en regard de ce qui était dû.
 *
 * L'écart entre les deux est le seul chiffre qui compte au moment de confirmer :
 * un règlement partiel confirmé par inadvertance se découvre à la livraison,
 * quand il est trop tard pour revenir dessus. On l'affiche donc en clair, dès
 * que l'admin saisit ce qu'il a réellement reçu.
 */
export default function PreuveReglement({
  commande,
  montantRecu,
  onMontantRecu,
}: PreuveReglementProps) {
  const [lienRecu, setLienRecu] = useState<string | null>(null);

  useEffect(() => {
    if (!commande.preuve_paiement_chemin) {
      setLienRecu(null);
      return;
    }
    const signer = async () => {
      // Lien signé et court : le compartiment est privé, et une URL de reçu qui
      // survivrait à la session circulerait par capture d'écran.
      const { data } = await supabase.storage
        .from(PREUVES_PAIEMENT_BUCKET)
        .createSignedUrl(commande.preuve_paiement_chemin as string, 600);
      setLienRecu(data?.signedUrl ?? null);
    };
    signer();
  }, [commande.preuve_paiement_chemin]);

  const recu = Number(montantRecu);
  const ecart = Number.isFinite(recu) && montantRecu !== '' ? recu - commande.montant_total_fcfa : 0;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <ReceiptText className="h-4 w-4" />
        Règlement déclaré par le client
      </p>

      {commande.paiement_declare_le ? (
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Déclaré le {new Date(commande.paiement_declare_le).toLocaleString('fr-FR')}
            {commande.canal_paiement_declare ? ` · ${commande.canal_paiement_declare}` : ''}
          </p>
          {commande.reference_transaction && (
            <p className="break-words">
              Référence :{' '}
              <span className="font-medium text-foreground">{commande.reference_transaction}</span>
            </p>
          )}
          {/* Ce que le client dit avoir versé. Le serveur a déjà refusé toute
              déclaration qui ne correspondait pas au dû : la voir ici sert à
              confronter au relevé, pas à recontrôler l'arithmétique. */}
          {commande.montant_declare_fcfa != null && (
            <p>
              Déclaré :{' '}
              <span className="font-medium text-foreground">
                {Number(commande.montant_declare_fcfa).toLocaleString('fr-FR')} FCFA
              </span>
            </p>
          )}
          {lienRecu ? (
            <a
              href={lienRecu}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-primary underline"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Voir le reçu joint
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            commande.preuve_paiement_chemin && <p>Reçu joint (chargement…)</p>
          )}
          {!commande.reference_transaction && !commande.preuve_paiement_chemin && (
            <p className="flex gap-1.5 text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Déclaré sans référence ni reçu — commande antérieure à la trace obligatoire.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Le client n'a pas encore déclaré de règlement.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="montant-recu">Montant réellement reçu (FCFA)</Label>
        <Input
          id="montant-recu"
          type="number"
          min={0}
          value={montantRecu}
          onChange={(e) => onMontantRecu(e.target.value)}
          placeholder={String(commande.montant_total_fcfa)}
        />
        <p className="text-xs text-muted-foreground">
          Dû : {commande.montant_total_fcfa.toLocaleString('fr-FR')} FCFA.
        </p>
        {montantRecu !== '' && Number.isFinite(recu) && ecart !== 0 && (
          <p
            className={`text-xs font-medium ${ecart < 0 ? 'text-destructive' : 'text-foreground'}`}
          >
            {ecart < 0
              ? `Manque ${Math.abs(ecart).toLocaleString('fr-FR')} FCFA.`
              : `Trop-perçu de ${ecart.toLocaleString('fr-FR')} FCFA.`}
          </p>
        )}
      </div>

      {/* Renseigner le montant reçu n'est pas obligatoire : mieux vaut une
          confirmation sans chiffre qu'un chiffre inventé pour débloquer l'écran. */}
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-xs text-muted-foreground"
        onClick={() => onMontantRecu(String(commande.montant_total_fcfa))}
      >
        Reçu le montant exact
      </Button>
    </div>
  );
}
