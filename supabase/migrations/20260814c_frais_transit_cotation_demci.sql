-- ---------------------------------------------------------------------------
-- Les premiers frais de transit RÉELS de la maison.
--
-- Source : cotation DEMCI du 20/05/2025, dossier d'import aérien (LTA), fournie
-- par le fondateur. Les montants ne sont pas estimés : ils sont recoupés en
-- partie double contre le devis lui-même —
--
--   bloc DÉBOURS DOUANE   509 187  (= le total imprimé au devis)
--   bloc DÉBOURS DIVERS   386 654
--   NET À PAYER           895 841  (= le montant écrit en toutes lettres)
--
-- Ce recoupement est la preuve que chaque montant est bien rattaché à sa
-- ligne : une seule erreur d'affectation ferait tomber la somme à côté.
--
-- Au passage, la même cotation valide la règle de TVA codée dans le moteur :
-- (CAF + DD + RST) × 18 % rend 206 184, exactement le chiffre du devis, alors
-- qu'en y ajoutant PCS, PUA et PCC on obtiendrait 208 740. Le devis tranche.
-- ---------------------------------------------------------------------------

-- Trois postes du devis n'existaient pas encore dans la table.
insert into app_e08c374bc4_frais_transit_local
  (code, libelle, sens, mode, assiette, montant_fcfa, confirme, actif, ordre, source, note)
values
  ('TIRAGE', 'Tirage de la déclaration', 'les_deux', 'tous', 'forfait', 70000, true, true, 20,
   'Cotation DEMCI du 20/05/2025',
   'Édition de la déclaration en détail. Forfait par déclaration.'),

  ('APUREMENT_D3', 'Apurement de la déclaration D3', 'les_deux', 'tous', 'forfait', 20000, true, true, 21,
   'Cotation DEMCI du 20/05/2025',
   'Clôture du régime de transit D3. Forfait par déclaration.'),

  ('AGIO', 'Frais d''agio', 'les_deux', 'tous', 'forfait', 10000, true, true, 22,
   'Cotation DEMCI du 20/05/2025',
   'Frais bancaires sur l''avance de trésorerie faite pour le compte du client.')
on conflict (code) do update set
  libelle = excluded.libelle, montant_fcfa = excluded.montant_fcfa,
  assiette = excluded.assiette, confirme = excluded.confirme,
  source = excluded.source, note = excluded.note;

-- Les honoraires étaient prévus en pourcentage de la valeur en douane. La
-- maison les facture en réalité au forfait : 100 000 par dossier, quelle que
-- soit la valeur. On corrige l'assiette plutôt que de garder un taux qui
-- n'existe pas.
update app_e08c374bc4_frais_transit_local set
  assiette = 'forfait',
  montant_fcfa = 100000,
  taux = null,
  minimum_fcfa = null,
  confirme = true,
  source = 'Cotation DEMCI du 20/05/2025',
  note = 'H.A.D. — honoraires de la maison, au forfait par dossier. Le devis '
      || 'de référence les facture 100 000 sur une valeur en douane de 946 667, '
      || 'soit un forfait et non un pourcentage.'
where code = 'HONORAIRES';

-- Le passage/magasinage figure au devis pour 150 000, mais ce poste croît avec
-- le nombre de jours passés sous douane : un montant relevé sur un dossier ne
-- vaut pas barème. On enregistre l'observation SANS la confirmer, pour que le
-- moteur continue de dire « je ne sais pas » plutôt que d'annoncer 150 000 à
-- un client dont le dossier dormira trois semaines.
update app_e08c374bc4_frais_transit_local set
  source = 'Observé — cotation DEMCI du 20/05/2025',
  note = 'Court par nature : il croît avec le nombre de jours passés sous '
      || 'douane. Relevé à 150 000 sur un dossier aérien sans retard — valeur '
      || 'd''ordre de grandeur, pas un barème. À confirmer par le fondateur '
      || 'avant tout affichage.'
where code = 'MAGASINAGE';
