import { Ship, FileSearch } from 'lucide-react';

/**
 * Ce qu'on dit du transport quand on ne le connaît pas encore.
 *
 * LA RÈGLE DU FONDATEUR, ET POURQUOI ELLE EST JUSTE
 *
 * « Le groupage ne doit pas afficher le prix du fret car il n'est pas vérifié.
 * Il faut faire comprendre que le fret sera communiqué après vérification. »
 *
 * C'est la même règle qui tient partout ailleurs dans cette application : on ne
 * montre pas un chiffre qu'on ne peut pas tenir. Un fret de groupage dépend du
 * volume réel du conteneur au départ, du groupeur retenu, et des frais
 * d'arrivée du jour. Afficher une estimation reviendrait à annoncer un prix
 * qu'on devrait ensuite corriger — et un prix corrigé après commande, c'est un
 * client perdu, pas un client informé.
 *
 * NE RIEN DIRE SERAIT PIRE QU'ANNONCER UN CHIFFRE
 *
 * Un panier qui ne parle pas du transport laisse croire qu'il est compris, ou
 * qu'il n'existe pas. La déception arrive alors à la facture, au pire moment.
 *
 * Cet encart tient donc les trois choses à la fois : le transport EXISTE, il
 * n'est PAS encore chiffré, et voici QUAND il le sera. Trois phrases, dans cet
 * ordre — c'est l'ordre des questions que se pose celui qui lit.
 *
 * ET IL NE PROMET PAS « PAS CHER »
 *
 * Aucun superlatif, aucune fourchette. Dire « le groupage revient beaucoup
 * moins cher » serait déjà un engagement chiffré déguisé.
 */

export default function FretApresVerification({
  compact = false,
}: {
  /** Version resserrée pour une ligne de panier, plutôt qu'un bloc de page. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Ship className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span>
          Transport maritime <strong className="text-foreground">non encore chiffré</strong> — il
          vous sera communiqué après vérification du volume, avant tout paiement.
        </span>
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <FileSearch className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-display font-semibold text-foreground">
            Le transport de cet article est communiqué après vérification
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cet article voyage par groupage maritime. Son transport dépend du volume réellement
            embarqué et du conteneur retenu : nous ne l’affichons donc pas tant qu’il n’est pas
            vérifié, plutôt que d’annoncer un montant que nous devrions corriger.
          </p>

          {/* L'ordre compte : ce que le client donne, ce qu'il reçoit, et quand
              il s'engage. La dernière ligne est celle qui rassure vraiment. */}
          <ol className="mt-3 space-y-1.5 text-sm text-foreground">
            <li className="flex gap-2">
              <span className="font-display font-semibold text-primary">1.</span>
              <span>Vous validez votre sélection — le prix de la marchandise est ferme.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-display font-semibold text-primary">2.</span>
              <span>Nous vérifions le volume et demandons le tarif au groupeur.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-display font-semibold text-primary">3.</span>
              <span>
                Vous recevez le transport chiffré et vous décidez.{' '}
                <strong>Aucun paiement ne part avant.</strong>
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
