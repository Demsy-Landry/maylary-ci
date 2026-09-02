-- La ligne de commande dit comment elle voyage.
--
-- LE PROBLÈME
--
-- Jusqu'ici, pour savoir si un article partait en porte-à-porte ou par la mer,
-- il fallait relire la fiche du PRODUIT. Or cette fiche vit : le transporteur
-- peut refuser demain ce qu'il cotait hier, et la retarification réécrit
-- `mode_acheminement` toutes les heures. Une commande passée en septembre
-- relue en octobre aurait donc raconté le voyage d'octobre, pas le sien.
--
-- Pire, cela rendait impossible le choix du client. La règle de la maison dit
-- que le groupage vaut pour ce que le transporteur ne prend pas « ou par choix
-- du client » — ce dernier cas n'existait nulle part : un article que le
-- transporteur acceptait partait forcément en express, sans que le client
-- puisse arbitrer entre le prix et le délai. Sur des articles de moins de
-- 100 000 F et de quelques dizaines de grammes, l'express double parfois le
-- montant de la commande.
--
-- CE QU'ON ÉCRIT
--
-- Le mode d'acheminement est FIGÉ SUR LA LIGNE au moment de l'achat. C'est lui
-- qui fait foi ensuite, pas la fiche produit. La transmission au fournisseur le
-- lit là : une ligne en groupage ne lui est pas soumise, puisqu'il a refusé de
-- la coter — ou que le client a payé le tarif maritime.
--
-- La colonne reste nullable À DESSEIN : les commandes antérieures n'ont pas ce
-- renseignement, et une valeur par défaut leur inventerait un acheminement
-- qu'elles n'ont jamais eu. Vide, le code retombe sur la fiche produit, ce qui
-- est exactement ce qu'il faisait avant.

alter table public.app_e08c374bc4_lignes_commande_gp
  add column if not exists mode_acheminement text
    check (mode_acheminement in ('cj_ddp', 'groupage'));

comment on column public.app_e08c374bc4_lignes_commande_gp.mode_acheminement is
  'Par où cette ligne voyage, figé à l''achat. Fait foi sur la fiche produit, '
  'qui peut changer après la commande. NULL sur les commandes antérieures à '
  'cette colonne : le code retombe alors sur le produit.';

-- Et la trace du choix, au niveau de la commande.
--
-- Le choix vaut pour TOUT le panier, jamais ligne par ligne : deux
-- acheminements ne voyagent pas ensemble, et laisser le client cocher article
-- par article créerait deux expéditions là où il croit n'en payer qu'une.
--
-- On le garde pour pouvoir répondre, six semaines plus tard, à la seule
-- question qui compte alors : « pourquoi ma commande n'est pas encore
-- arrivée ? » La réponse doit être vérifiable, pas reconstituée.

alter table public.app_e08c374bc4_commandes_gp
  add column if not exists groupage_choisi_par_le_client boolean not null default false;

comment on column public.app_e08c374bc4_commandes_gp.groupage_choisi_par_le_client is
  'Le client a demandé le groupage maritime sur un panier que le transporteur '
  'acceptait de porter : il a préféré le prix au délai. Distingue ce choix du '
  'groupage subi, où le transporteur refuse la marchandise.';
