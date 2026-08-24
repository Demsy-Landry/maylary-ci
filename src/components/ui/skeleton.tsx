import { cn } from "@/lib/utils"

/**
 * Le rectangle qui occupe la place pendant qu'une donnée arrive.
 *
 * POURQUOI PAS `bg-accent`
 *
 * Il était peint en `bg-accent` — le turquoise de la marque, saturé. Sur une
 * connexion rapide personne ne le voit ; sur une liaison mobile abidjanaise,
 * le client regarde pendant deux secondes quatre rectangles criards, et
 * l'application paraît cassée avant même d'avoir fini de charger.
 *
 * Un squelette n'est pas un élément de marque : c'est une absence qu'on rend
 * supportable. Il doit être assez visible pour dire « ça vient », assez
 * discret pour qu'on l'oublie dès que le contenu paraît.
 *
 * `bg-muted` est ce gris-là, et il suit déjà les deux thèmes.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
