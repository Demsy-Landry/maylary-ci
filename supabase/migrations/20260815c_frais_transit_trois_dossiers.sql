-- Les trois cotations réelles du fondateur, mises côte à côte.
--
--   A  DEMCI 20/05/2025      aérien (LTA)      CAF 946 667
--   B  cotation Menzies      aérien            FOB 1 200 USD, fret 370 USD
--   C  proforma Mundra       maritime 1×20'    27 t, HS 6907.21
--
-- Ce que le recoupement apprend, et qu'un seul document ne pouvait pas dire :
-- certains postes NE DÉPENDENT PAS du mode (le passage en douane vaut 150 000
-- dans les trois), et d'autres en dépendent violemment — les honoraires vont
-- de 100 000 en aérien à 500 000 sur un conteneur. Un barème unique aurait
-- sous-facturé le maritime ou sur-facturé l'aérien.
--
-- Quand deux documents divergent sur un même poste, on retient le plus élevé.
-- C'est la doctrine du fondateur, appliquée ici au transit comme au fret :
-- « dans l'extrême vigilance, au-dessus de la moyenne ».

insert into app_e08c374bc4_frais_transit_local
  (code, libelle, sens, mode, assiette, montant_fcfa, confirme, actif, ordre, source, note)
values
  ('PASSAGE_DOUANE', 'Passage en douane', 'import', 'tous', 'forfait', 150000, true, true, 23,
   'Cotations DEMCI, Menzies et Mundra — 150 000 dans les trois',
   'Le poste le mieux établi de tous : trois dossiers différents, deux modes de transport, le même montant.'),

  ('RETRAIT_DOCUMENTAIRE', 'Retrait documentaire', 'import', 'aerien', 'forfait', 30000, true, true, 24,
   'Cotation aérienne (Menzies Aviation)',
   'Retrait des documents auprès du gestionnaire de fret aérien.'),

  ('FDI_RFCV', 'FDI et RFCV', 'import', 'tous', 'forfait', 50000, true, true, 25,
   'Proforma Mundra — FDI 20 000 + RFCV 30 000',
   'Les deux formalités du Guichet Unique. La cotation aérienne les groupe à '
   '30 000, la proforma maritime les détaille à 20 000 + 30 000 : on retient '
   'la somme détaillée, la plus élevée des deux.'),

  ('TAXE_SYDAM', 'Taxe de déclaration SYDAM', 'les_deux', 'tous', 'forfait', 23350, true, true, 26,
   'Proforma Mundra',
   'Redevance du système informatique douanier, par déclaration.'),

  ('ECHANGE_BL', 'Échange du connaissement (B/L)', 'import', 'maritime', 'forfait', 555359, true, true, 27,
   'Proforma Mundra — conteneur 20 pieds',
   'Frais de la compagnie maritime pour la remise du titre. Relevé sur un 20 pieds : '
   'à revoir pour un 40 pieds et pour le groupage.')
on conflict (code) do update set
  libelle = excluded.libelle, sens = excluded.sens, mode = excluded.mode,
  assiette = excluded.assiette, montant_fcfa = excluded.montant_fcfa,
  confirme = excluded.confirme, source = excluded.source, note = excluded.note;

-- Le tirage varie : 50 000 (Menzies), 60 000 (Mundra), 70 000 (DEMCI). On
-- garde le plus élevé, et on le dit.
update app_e08c374bc4_frais_transit_local set
  montant_fcfa = 70000, confirme = true,
  source = 'Trois cotations : 50 000, 60 000 et 70 000 — plafond retenu',
  note = 'Édition de la déclaration en détail. Les trois dossiers de référence '
      || 'donnent 50 000, 60 000 et 70 000 : on retient 70 000, jamais dépassé.'
where code = 'TIRAGE';

-- Les honoraires dépendent du conditionnement, pas d'un forfait unique.
update app_e08c374bc4_frais_transit_local set
  montant_fcfa = 100000, confirme = true, mode = 'aerien',
  source = 'Cotations DEMCI et Menzies — 100 000 en aérien',
  note = 'H.A.D. — honoraires de la maison, au forfait. 100 000 en aérien sur '
      || 'deux dossiers concordants. Le conteneur maritime relève d''une autre '
      || 'ligne : la proforma Mundra facture 500 000 sur un 20 pieds.'
where code = 'HONORAIRES';

insert into app_e08c374bc4_frais_transit_local
  (code, libelle, sens, mode, assiette, montant_fcfa, confirme, actif, ordre, source, note)
values
  ('HONORAIRES_CONTENEUR', 'Honoraires de transit — conteneur maritime', 'les_deux', 'maritime',
   'par_conteneur', 500000, true, true, 19,
   'Proforma Mundra — 1 × 20 pieds',
   'Un conteneur demande un travail sans commune mesure avec un colis aérien : '
   'échange de titre, acconage, empotage, suivi de terminal. D''où 500 000 au '
   'lieu de 100 000. Relevé sur un 20 pieds.')
on conflict (code) do update set
  montant_fcfa = excluded.montant_fcfa, confirme = excluded.confirme,
  source = excluded.source, note = excluded.note;

-- L'acconage était déclaré par conteneur sans montant : la proforma le donne.
update app_e08c374bc4_frais_transit_local set
  montant_fcfa = 250774, confirme = true,
  source = 'Proforma Mundra — conteneur 20 pieds',
  note = 'Manutention portuaire, relevée sur un 20 pieds à Abidjan. Le 40 pieds '
      || 'et le groupage restent à confirmer.'
where code = 'ACCONAGE';
