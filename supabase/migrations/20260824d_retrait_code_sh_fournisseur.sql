-- Le code SH du fournisseur est retiré, sur décision du fondateur.
--
-- Je l'avais gardé en me disant qu'une hypothèse valait mieux qu'une page
-- blanche. Le fondateur a tranché autrement : « elles peuvent ne pas être
-- correctes ». Son raisonnement est le bon.
--
-- C'est un fournisseur chinois qui saisit ce code, pour SON export, sous SA
-- réglementation. Il n'engage rien envers la douane ivoirienne. Or il se serait
-- retrouvé à côté du moteur de liquidation — et une position fausse posée près
-- d'un calcul de droits ne reste pas longtemps une suggestion : elle finit
-- recopiée.
--
-- Le risque n'est pas théorique. Une mauvaise position, c'est un taux de droit
-- faux, une déclaration à corriger, et la signature d'un commissionnaire
-- engagée sur une erreur. Mieux vaut une case vide, qui oblige à classer, que
-- l'ombre d'une réponse.
--
-- La colonne est supprimée plutôt que vidée : une colonne qui existe finit par
-- être relue, et le raisonnement qui l'a écartée ne sera plus là.

alter table public.app_e08c374bc4_produits
  drop column if exists code_sh_fournisseur;
