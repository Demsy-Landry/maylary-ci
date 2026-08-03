import { useEffect, useState } from 'react';
import {
  supabase,
  AVIS_ARTICLES_TABLE,
  type AvisArticle,
  type LigneCommandeGP,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import NoteEtoiles from '@/components/NoteEtoiles';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface AvisCommandeProps {
  commandeId: string;
  userId: string;
  lignes: LigneCommandeGP[];
}

interface Brouillon {
  note: number;
  commentaire: string;
}

/**
 * Notation des articles d'une commande livrée.
 *
 * Le droit d'écrire ici n'est pas décidé par ce composant : la base vérifie que
 * la commande appartient au client, qu'elle est livrée, et que l'article y
 * figurait. Le formulaire ne fait que refléter cette règle à l'écran, pour que
 * le client ne se heurte pas à un refus qu'il ne comprendrait pas.
 *
 * Un avis par article et par commande : le second dépôt est donc une
 * correction, pas un nouvel avis.
 */
export default function AvisCommande({ commandeId, userId, lignes }: AvisCommandeProps) {
  const [avis, setAvis] = useState<Record<string, AvisArticle>>({});
  const [brouillons, setBrouillons] = useState<Record<string, Brouillon>>({});
  const [loading, setLoading] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);

  // Une ligne peut avoir perdu son produit_id si l'article a quitté le
  // catalogue : on ne propose alors rien plutôt qu'un formulaire sans cible.
  const notables = lignes.filter((l): l is LigneCommandeGP & { produit_id: string } => !!l.produit_id);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from(AVIS_ARTICLES_TABLE)
        .select('*')
        .eq('commande_id', commandeId)
        .eq('user_id', userId);
      const parProduit: Record<string, AvisArticle> = {};
      for (const a of (data as AvisArticle[]) ?? []) parProduit[a.produit_id] = a;
      setAvis(parProduit);
      setLoading(false);
    };
    load();
  }, [commandeId, userId]);

  const brouillonDe = (produitId: string): Brouillon =>
    brouillons[produitId] ?? {
      note: avis[produitId]?.note ?? 0,
      commentaire: avis[produitId]?.commentaire ?? '',
    };

  const majBrouillon = (produitId: string, champ: Partial<Brouillon>) =>
    setBrouillons((prev) => ({ ...prev, [produitId]: { ...brouillonDe(produitId), ...champ } }));

  const envoyer = async (produitId: string) => {
    const brouillon = brouillonDe(produitId);
    if (brouillon.note < 1) {
      toast.info('Choisissez une note de 1 à 5 étoiles.');
      return;
    }

    setEnCours(produitId);
    const existant = avis[produitId];
    const commentaire = brouillon.commentaire.trim() || null;

    const { data, error } = existant
      ? await supabase
          .from(AVIS_ARTICLES_TABLE)
          .update({ note: brouillon.note, commentaire })
          .eq('id', existant.id)
          .select('*')
          .single()
      : await supabase
          .from(AVIS_ARTICLES_TABLE)
          .insert({
            produit_id: produitId,
            commande_id: commandeId,
            user_id: userId,
            note: brouillon.note,
            commentaire,
          })
          .select('*')
          .single();

    setEnCours(null);

    if (error || !data) {
      toast.error("Votre avis n'a pas pu être enregistré. Réessayez dans un instant.");
      return;
    }

    setAvis((prev) => ({ ...prev, [produitId]: data as AvisArticle }));
    setBrouillons((prev) => {
      const suite = { ...prev };
      delete suite[produitId];
      return suite;
    });
    toast.success(existant ? 'Votre avis a été corrigé.' : 'Merci, votre avis est publié.');
  };

  if (notables.length === 0) return null;

  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium text-foreground">Votre avis sur ces articles</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Vous seul pouvez noter ce que vous avez réellement reçu. C'est ce qui nous permet
        d'écarter un fournisseur qui déçoit — et c'est ce qui aide les prochains acheteurs.
      </p>

      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {notables.map((ligne) => {
            const brouillon = brouillonDe(ligne.produit_id);
            const existant = avis[ligne.produit_id];
            const modifie =
              !existant ||
              brouillon.note !== existant.note ||
              brouillon.commentaire.trim() !== (existant.commentaire ?? '');

            return (
              <div key={ligne.id} className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm text-foreground">{ligne.nom_produit}</p>

                <div className="flex items-center gap-2">
                  <NoteEtoiles
                    note={brouillon.note}
                    taille={22}
                    onChange={(note) => majBrouillon(ligne.produit_id, { note })}
                  />
                  {existant && !modifie && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Avis publié
                    </span>
                  )}
                </div>

                <Textarea
                  value={brouillon.commentaire}
                  onChange={(e) => majBrouillon(ligne.produit_id, { commentaire: e.target.value })}
                  rows={2}
                  placeholder="Ce qui vous a plu, ce qui vous a déçu (optionnel)"
                />

                {modifie && (
                  <Button
                    size="sm"
                    onClick={() => envoyer(ligne.produit_id)}
                    disabled={enCours === ligne.produit_id}
                  >
                    {enCours === ligne.produit_id && (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    )}
                    {existant ? 'Corriger mon avis' : 'Publier mon avis'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
