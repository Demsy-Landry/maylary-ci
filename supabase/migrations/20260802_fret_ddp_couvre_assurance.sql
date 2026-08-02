-- Quand le transporteur cote un porte-à-porte droits acquittés (DDP), son prix
-- couvre l'acheminement complet, les droits de douane et sa responsabilité sur
-- la marchandise. L'incoterm d'achat auprès du fournisseur ne commande plus
-- l'assurance : ajouter une police facultés locale par-dessus revient à payer
-- deux fois la même couverture.
--
-- Cela pesait lourd : les frais de police de 2 500 FCFA sont dus par expédition,
-- donc identiques pour un colis de 126 FCFA et pour une palette. Sur les petits
-- articles, la prime représentait jusqu'à 40 % du coût de revient.
--
-- Souscrire une police à 2 500 FCFA pour un colis postal n'a pas de sens
-- économique. Le risque reste réel mais il est porté par les conditions du
-- transporteur et absorbé dans la marge. En groupage maritime, où une vraie
-- police est souscrite pour l'expédition, le barème de l'assureur s'applique
-- pleinement.
alter table app_e08c374bc4_parametres_import
  add column if not exists fret_transporteur_couvre_assurance boolean not null default true;

comment on column app_e08c374bc4_parametres_import.fret_transporteur_couvre_assurance is
  'Vrai quand le devis du transporteur est un porte-à-porte droits acquittés : aucune prime d''assurance locale n''est alors ajoutée. Sans effet sur le fret forfaitaire et sur le groupage maritime.';
