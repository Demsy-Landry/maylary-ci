-- Le client choisit son transporteur avant de payer.
--
-- Jusqu'ici Maylary retenait d'office l'option la moins chère du fournisseur.
-- C'est le bon réflexe pour fixer un prix de vente, mais pas pour servir un
-- client : sur un même colis, l'écart mesuré va de 11,04 $ en 20-60 jours à
-- 85,41 $ en 3-7 jours. Qui paie décide.
--
-- Le prix de vente des articles contient déjà le transport économique. Choisir
-- plus rapide ajoute donc un supplément, jamais un prix refait : le montant
-- annoncé avant paiement reste celui qu'on encaisse.
alter table app_e08c374bc4_commandes_gp
  add column if not exists transporteur_choisi text,
  add column if not exists supplement_transporteur_fcfa numeric not null default 0,
  add column if not exists delai_transporteur text;

comment on column app_e08c374bc4_commandes_gp.transporteur_choisi is
  'Transporteur retenu par le client ; repris tel quel à la transmission de la commande au fournisseur.';
comment on column app_e08c374bc4_commandes_gp.supplement_transporteur_fcfa is
  'Écart entre le transporteur choisi et l''option économique déjà comprise dans les prix.';
comment on column app_e08c374bc4_commandes_gp.delai_transporteur is
  'Délai annoncé par le transporteur au moment du choix, en jours.';
