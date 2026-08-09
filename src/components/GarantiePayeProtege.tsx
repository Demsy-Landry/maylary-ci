import { ShieldCheck } from 'lucide-react';

/**
 * L'engagement « payé, protégé », écrit là où la peur se trouve.
 *
 * Sur ce marché, le paiement à la livraison n'est pas un service : c'est le
 * prix de la méfiance. Il coûte cher et il plafonne le panier, parce que
 * personne ne fait livrer contre remboursement un lot à 800 000 FCFA. On ne
 * répond pas à cette méfiance par une promesse commerciale mais par un
 * mécanisme : l'argent d'un vendeur tiers ne part qu'après la réception.
 *
 * Le texte reste au présent et sans superlatif. Il décrit ce que la base fait
 * réellement — un client qui vérifie doit trouver exactement ça.
 */
export default function GarantiePayeProtege({
  variante = 'client',
}: {
  /** « client » rassure l'acheteur ; « vendeur » rassure l'entreprise vendeuse. */
  variante?: 'client' | 'vendeur';
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 text-sm">
        <p className="font-display font-bold text-foreground">Payé, protégé</p>
        {variante === 'client' ? (
          <p className="mt-0.5 text-muted-foreground">
            Pour un article vendu par une entreprise partenaire, votre règlement est retenu par
            MayLary Group jusqu'à ce que vous confirmiez avoir reçu votre commande. Vous payez d'avance
            sans payer à l'aveugle.
          </p>
        ) : (
          <p className="mt-0.5 text-muted-foreground">
            Votre règlement est libéré dès que l'acheteur confirme la réception — et
            automatiquement passé le délai de contestation, même si l'acheteur ne se manifeste
            pas. Un client silencieux ne peut pas geler votre argent.
          </p>
        )}
      </div>
    </div>
  );
}
