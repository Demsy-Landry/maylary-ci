-- L'exportation devient liquidable : timbre statistique seul.
--
-- Règle donnée par le fondateur, déclarant agréé :
--
--   « L'export D6 ne paie que le TS, 20 000 XOF par déclaration, comme à
--     l'import. Les autres taxes sont liées à l'importation seule. Et c'est
--     toujours par déclaration à l'export — pas de RPI. »
--
-- Ce que cela donne dans les trois drapeaux du moteur :
--
--   droits_exigibles = faux  → DD, RST, PCS, PUA, PCC et TVA à zéro. Ce sont
--                              des impositions à l'entrée sur le territoire
--                              douanier ; une marchandise qui sort ne les doit
--                              pas.
--   rpi_exigible     = faux  → pas de redevance de prestation informatique.
--   ts_exigible      = vrai  → 20 000 XOF, une fois par déclaration et non par
--                              ligne. Le noyau lit déjà `montant_fixe_fcfa` de
--                              la table des taxes : rien à changer au calcul.
--
-- Les trois familles de la nomenclature DGD-CI déposées sur un D6 sont
-- concernées : 1xxx exportation, 2xxx perfectionnement passif, 3xxx
-- réexportation. Le perfectionnement passif reviendra un jour à l'import, et
-- c'est à ce moment-là que les droits se poseront — pas à la sortie.
--
-- ⚠️ Réserve à lever par le fondateur, écrite ici pour qu'elle ne se perde
-- pas : certaines marchandises supportent un Droit Unique de Sortie (cacao,
-- café, noix de cajou). Ce n'est pas une taxe de la déclaration mais une
-- imposition attachée au produit, et le corpus TEC ne la porte pas. Tant
-- qu'elle n'est pas confirmée et tarifée, la mention du régime le dit en
-- clair au lieu de laisser croire que 20 000 XOF est le total dû sur un
-- conteneur de fèves.

update app_e08c374bc4_regimes_douaniers
set liquidation_supportee = true,
    droits_exigibles      = false,
    rpi_exigible          = false,
    ts_exigible           = true,
    caution_requise       = false,
    mention               = case left(code, 1)
      when '2' then
        'Perfectionnement passif : à la sortie, seul le timbre statistique de 20 000 XOF est dû, une fois par déclaration. Les droits et taxes se poseront au retour de la marchandise, sur la déclaration d''importation. Hors produits soumis au Droit Unique de Sortie.'
      when '3' then
        'Réexportation : seul le timbre statistique de 20 000 XOF est dû, une fois par déclaration. Les droits et taxes à l''importation ne s''appliquent pas à une marchandise qui quitte le territoire. Hors produits soumis au Droit Unique de Sortie.'
      else
        'Exportation : seul le timbre statistique de 20 000 XOF est dû, une fois par déclaration. Ni droits de douane, ni TVA, ni prélèvements communautaires, ni redevance informatique — ces impositions sont liées à l''importation. Hors produits soumis au Droit Unique de Sortie (cacao, café, noix de cajou…), qui reste à confirmer.'
    end
where left(code, 1) in ('1', '2', '3');
