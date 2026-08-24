import { Ship, Clock, Users } from 'lucide-react';

/**
 * Ce que voit un client dont le panier contient un article de groupage.
 *
 * POURQUOI CET ENCART EXISTE
 *
 * Certains articles ne sont pas cotés par CJ — trop volumineux, trop lourds,
 * ou d'un fournisseur que le transporteur ne dessert pas. Jusqu'ici ils étaient
 * simplement éteints : le client ne les voyait pas, et la maison perdait la
 * vente. Ils partent désormais par la consolidation maritime.
 *
 * Mais un groupage ne part pas le jour où l'on commande : il attend d'être
 * plein. C'est le prix de son avantage — un fret divisé par trente. Le client
 * doit comprendre CE QU'IL ÉCHANGE avant de valider, pas le découvrir en
 * regardant son suivi trois semaines plus tard.
 *
 * D'où le parti pris : on annonce le délai en premier, comme une contrainte
 * assumée, et l'économie ensuite comme sa contrepartie. L'ordre inverse
 * ressemblerait à une promotion dont on cache le défaut.
 */
export default function FileGroupage({
  nombreArticles,
  delaiMin = 35,
  delaiMax = 45,
}: {
  nombreArticles: number;
  delaiMin?: number;
  delaiMax?: number;
}) {
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Ship className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display font-semibold text-foreground">
            {nombreArticles === 1
              ? 'Cet article part en groupage maritime'
              : `Ces ${nombreArticles} articles partent en groupage maritime`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ils sont trop volumineux pour l’express. Nous les rassemblons avec les
            commandes d’autres clients dans un même conteneur — c’est ce qui rend
            leur transport abordable.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              <span>
                Livraison en <strong>{delaiMin} à {delaiMax} jours</strong>
              </span>
            </p>
            <p className="flex items-center gap-2 text-sm text-foreground">
              <Users className="h-4 w-4 shrink-0 text-primary" />
              <span>Départ dès que le conteneur est complet</span>
            </p>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Vous serez prévenu à chaque étape : rattachement au départ, embarquement,
            arrivée à Abidjan, dédouanement, livraison.
          </p>
        </div>
      </div>
    </div>
  );
}
