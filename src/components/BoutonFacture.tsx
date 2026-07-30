import { useState } from 'react';
import { toast } from 'sonner';
import { supabase, EDGE_FUNCTIONS_URL, type Facture, type SourceFacture, type TypeDocumentFacture } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Receipt } from 'lucide-react';

/**
 * Émet (si besoin) puis télécharge la facture ou la proforma d'un dossier.
 *
 * Le document est numéroté et figé côté serveur : un rappel ultérieur renvoie
 * exactement la même pièce, jamais un nouveau numéro.
 */
export default function BoutonFacture({
  sourceType,
  sourceId,
  typeDocument,
  variant = 'outline',
  className,
}: {
  sourceType: SourceFacture;
  sourceId: string;
  typeDocument: TypeDocumentFacture;
  variant?: 'outline' | 'default' | 'ghost';
  className?: string;
}) {
  const [enCours, setEnCours] = useState(false);
  const estProforma = typeDocument === 'proforma';

  const telecharger = async () => {
    setEnCours(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error('Reconnectez-vous pour télécharger votre document.');
        return;
      }

      const reponse = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_generer_facture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          source_type: sourceType,
          source_id: sourceId,
          type_document: typeDocument,
        }),
      });

      const resultat = await reponse.json();

      if (!reponse.ok) {
        toast.error(resultat?.error ?? 'Impossible de générer le document.');
        return;
      }

      // Chargé à la demande : la librairie PDF ne pèse sur le premier
      // affichage d'aucun visiteur qui ne télécharge pas de facture.
      const { telechargerFacturePdf } = await import('@/lib/facture-pdf');
      telechargerFacturePdf(resultat.facture as Facture);
      toast.success(
        `${estProforma ? 'Proforma' : 'Facture'} ${resultat.facture.numero} téléchargée.`,
      );
    } catch {
      toast.error('Connexion impossible. Réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  };

  const Icone = estProforma ? FileText : Receipt;

  return (
    <Button variant={variant} size="sm" onClick={telecharger} disabled={enCours} className={className}>
      {enCours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icone className="mr-2 h-4 w-4" />}
      {estProforma ? 'Facture proforma' : 'Facture'}
    </Button>
  );
}
