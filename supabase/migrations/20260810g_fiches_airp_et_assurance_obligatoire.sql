-- Trois fiches AIRP et l'obligation d'assurance, transcrites des documents
-- officiels fournis par le fondateur. Rien n'est inféré : chaque référence
-- légale, chaque qualité de demandeur et chaque pièce du dossier vient du
-- texte lui-même.

insert into app_e08c374bc4_marchandises_reglementees
  (code, libelle, famille, sens, autorite, autorite_sigle, base_legale, document_requis,
   personnes_morales_autorisees, pieces_du_dossier, exemplaires, adresse_depot, contact,
   site_web, difficulte, conseil_demarrage, mots_cles, note)
values

('airp_laits_farines_infantiles',
 'Laits et farines infantiles',
 'Produits de santé et parapharmacie', 'import',
 'Autorité Ivoirienne de Régulation Pharmaceutique', 'AIRP',
 'Décret n° 2013-416 du 6 juin 2013',
 'Autorisation de commercialisation délivrée par l''AIRP, préalable à toute importation',
 array['Industrie laitière',
       'Industrie agro-alimentaire',
       'Tout établissement légalement constitué',
       'Agence de représentation et de promotion de produits parapharmaceutiques'],
 array['Lettre de demande adressée au Directeur Général de l''AIRP, rédigée en français, une par présentation et par dosage',
       'Nature de la demande',
       'Noms et adresses du ou des fabricants',
       'Pays d''origine',
       'Noms et adresses du demandeur',
       'Noms et adresses de l''agence de représentation, le cas échéant',
       'Nom commercial du produit',
       'Modèle vente définitif (modèle commercial du produit)',
       'Échantillons',
       'Indications principales',
       'Formulaire de demande dûment rempli'],
 3,
 'AIRP, Cocody-Riviera Bonoumin, Rue I 89, Quartier Avocatier, 08 BP 3535 Abidjan 08',
 'secretariat@airp.ci — +225 25 22 00 55 61 / 25 22 00 47 15 / 25 22 00 40 65',
 'https://www.airp.ci',
 3,
 'À éviter tant que la maison n''a pas d''antériorité. Le texte est formel : « quelle que soit leur origine », ces produits ne peuvent être ni débités, ni importés, ni mis en vente sans enregistrement préalable. Le dossier se dépose en trois exemplaires, par présentation ET par dosage — une gamme de six références représente six dossiers. Prévoir plusieurs mois.',
 array['lait infantile','laits infantiles','farine infantile','farines infantiles','lait bebe',
       'lait pour bebe','formule infantile','preparation pour nourrisson','cereale infantile'],
 'Le texte vise les laits et farines infantiles quelle que soit leur origine — une marchandise CEDEAO ou européenne n''y échappe pas davantage qu''une marchandise chinoise.'),

('airp_complements_alimentaires',
 'Compléments alimentaires, produits nutritionnels, produits de régime et diététiques',
 'Produits de santé et parapharmacie', 'import',
 'Autorité Ivoirienne de Régulation Pharmaceutique', 'AIRP',
 'Décision n° 06/2010/CM/UEMOA du 1er octobre 2010 et Loi n° 2017-541 du 3 août 2017',
 'Autorisation de commercialisation délivrée par l''AIRP, préalable à toute importation',
 array['Tout établissement légalement constitué',
       'Agence de représentation et de promotion de produits parapharmaceutiques'],
 array['Lettre de demande adressée au Directeur Général de l''AIRP, rédigée en français, une par présentation, dosage et formule',
       'Nature de la demande',
       'Noms et adresses du ou des fabricants',
       'Pays d''origine',
       'Noms et adresses du demandeur',
       'Noms et adresses de l''agence de représentation, le cas échéant',
       'Nom commercial du produit',
       'Échantillons',
       'Formulaire de demande dûment rempli'],
 3,
 'AIRP, Cocody-Riviera Bonoumin, Rue I 89, Quartier Avocatier, 08 BP 3535 Abidjan 08',
 'secretariat@airp.ci — +225 25 22 00 55 61 / 25 22 00 47 15 / 25 22 00 40 65',
 'https://www.airp.ci',
 3,
 'Le rayon le plus tentant du commerce en ligne, et le plus piégeux. Vitamines, protéines, brûle-graisses, tisanes minceur : tout cela relève de l''AIRP dès qu''il est présenté comme complément alimentaire ou produit de régime. Un dossier par formule. À écarter d''un premier catalogue.',
 array['complement alimentaire','complements alimentaires','vitamine','vitamines','proteine',
       'proteines','whey','nutritionnel','produit de regime','dietetique','minceur',
       'brule graisse','gelule','complement nutritionnel'],
 null),

('airp_cosmetiques_allegation_sante',
 'Produits cosmétiques et d''hygiène corporelle comportant des allégations de santé',
 'Produits de santé et parapharmacie', 'import',
 'Autorité Ivoirienne de Régulation Pharmaceutique', 'AIRP',
 'Décision n° 07/2010/CM/UEMOA du 4 septembre 2010, Loi n° 2017-544 du 3 août 2017 et Décret n° 2015-288 du 29 avril 2015',
 'Autorisation de commercialisation délivrée par l''AIRP, préalable à toute importation',
 array['Industrie cosmétique',
       'Tout établissement légalement constitué',
       'Agence de représentation et de promotion de produits parapharmaceutiques'],
 array['Lettre de demande adressée au Directeur Général de l''AIRP, rédigée en français, une par forme galénique et par dosage',
       'Nature de la demande',
       'Noms et adresses du titulaire de l''autorisation de commercialisation dans le pays d''origine',
       'Noms et adresses du ou des fabricants',
       'Nom du laboratoire fabricant',
       'Adresse du ou des sites de fabrication, de conditionnement ou d''importation',
       'Noms et adresses du demandeur',
       'Noms et adresses de l''agence de représentation, le cas échéant',
       'Nom commercial du produit, dosage, forme et présentation'],
 3,
 'AIRP, Cocody-Riviera Bonoumin, Rue I 89, Quartier Avocatier, 08 BP 3535 Abidjan 08',
 'secretariat@airp.ci — +225 25 22 00 55 61 / 25 22 00 47 15 / 25 22 00 40 65',
 'https://www.airp.ci',
 2,
 'La nuance décide de tout : c''est l''ALLÉGATION DE SANTÉ qui fait basculer un cosmétique sous le régime AIRP, pas le produit lui-même. Un savon reste un savon ; le même savon vendu comme « traitant », « dépigmentant », « anti-acné » ou destiné à la vente en pharmacie relève de l''AIRP. Une reformulation de l''argumentaire commercial suffit parfois à rester hors du champ — c''est un conseil à donner avant l''achat, pas après.',
 array['cosmetique','cosmetiques','hygiene corporelle','creme','savon','lotion','serum',
       'depigmentant','eclaircissant','anti acne','soin visage','parapharmacie','argan'],
 'Point d''attention pour le sourcing marocain : la cosmétique à l''argan est un point fort marocain, et c''est précisément la famille où l''allégation de santé fait basculer sous le régime AIRP.')

on conflict (code) do nothing;

-- L'assurance à l'importation n'est pas une option commerciale : c'est une
-- obligation légale, avec une amende chiffrée. L'application calculait déjà la
-- prime ; elle ignorait le texte qui la rend obligatoire et la sanction encourue.
insert into app_e08c374bc4_regles_procedure
  (code, libelle, valeur, unite, sens, nature, reference, explication, ordre)
values
  ('ASSURANCE_OBLIGATOIRE', 'Assurance obligatoire à l''importation', 1, 'oui/non', 'import',
   'officiel',
   'Circulaire DGD n° 848 du 13 mai 1997 ; Ordonnance n° 97-217 du 16/04/1997 modifiant l''Ordonnance n° 97-121 du 07/03/1997',
   'Toute importation de biens et marchandises à des fins directement ou indirectement commerciales ou industrielles doit être couverte par une assurance. Le texte réserve un sort particulier aux colis postaux pris en charge par des professionnels, transporteurs ou auxiliaires de transport : à confirmer au cas par cas avant de s''en prévaloir.',
   10),

  ('ASSURANCE_AMENDE_DEFAUT', 'Amende en l''absence de certificat d''assurance', 20, '% de la valeur',
   'import', 'officiel',
   'Circulaire DGD n° 848 du 13 mai 1997',
   'Vingt pour cent de la valeur des biens ou marchandises importées. C''est la sanction la plus chère de tout le dossier d''importation : sur une marchandise à 10 millions, elle coûte 2 millions, quand la prime d''assurance elle-même se compte en dizaines de milliers.',
   11),

  ('ASSURANCE_COUVERTURE_MINIMUM', 'Couverture minimale de la valeur CAF', 95, '% de la valeur CAF',
   'import', 'officiel',
   'Circulaire DGD n° 848 du 13 mai 1997',
   'Sous-assurer est sanctionné de 50 000 à 500 000 FCFA lorsque la valeur assurée est inférieure à 95 % de la valeur CAF. Notre barème couvre (FOB + fret) × 110 %, donc au-dessus du seuil — mais un client qui apporte sa propre police doit être vérifié sur ce point.',
   12)

on conflict (code) do nothing;
