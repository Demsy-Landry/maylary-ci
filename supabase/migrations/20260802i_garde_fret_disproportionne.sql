-- Garde-fou contre le fret disproportionné.
--
-- Le plafond de commande minimum existant ne protège que des montants absolus.
-- Il a laissé entrer une lampe de bureau achetée 4 002 FCFA, avec 52 213 FCFA
-- de fret DHL — seul transport proposé par le fournisseur — et vendue
-- 78 701 FCFA. Le client aurait payé 93 % de transport.
--
-- Deux conditions doivent être réunies pour écarter un article, jamais une
-- seule : un rapport élevé sur une petite commande reste parfaitement
-- acceptable. Une pochette bulle a un rapport de fret de 10 et se vend
-- 500 FCFA ; personne ne s'en plaint. C'est la conjonction « transport
-- écrasant » et « facture salée » qui rend un article invendable.
--
-- Les deux valeurs sont réglables depuis l'écran d'administration : elles
-- viennent d'une mesure sur le catalogue, pas d'une règle du métier, et devront
-- bouger quand l'offre de transport changera.
alter table app_e08c374bc4_parametres_import
  add column if not exists ratio_fret_maximum numeric not null default 5,
  add column if not exists seuil_commande_surveillee_fcfa numeric not null default 20000;

comment on column app_e08c374bc4_parametres_import.ratio_fret_maximum is
  'Rapport maximum toléré entre le fret et le prix d''achat d''un article.';
comment on column app_e08c374bc4_parametres_import.seuil_commande_surveillee_fcfa is
  'En dessous de ce montant de commande minimum, le rapport de fret n''est pas opposé.';
