-- ---------------------------------------------------------------------------
-- La documentation, et pourquoi elle passe avant le reste.
--
-- Le fondateur : « La documentation est la plus importante. Si un détail est
-- oublié ou négligé, toute la procédure peut prendre un coup véritable. Une
-- bonne documentation signifie un bon transit local, un dédouanement sans
-- tracasserie. »
--
-- C'est exact, et c'est le trou le plus coûteux du produit jusqu'ici. Le
-- moteur savait calculer une taxe au franc près et ne savait pas dire qu'il
-- manquait un RFCV — alors qu'un RFCV manquant bloque un conteneur pendant
-- que le magasinage court.
--
-- Cette table N'EST PAS une aide-mémoire rédigée de tête. Chaque ligne porte
-- sa source et un drapeau « vérifié ». Ce qui est confirmé par un texte ou un
-- portail officiel est marqué comme tel ; ce qui vient du métier de la maison
-- reste à confirmer par le fondateur, et le dit. Un document annoncé à tort
-- comme obligatoire coûte de l'argent au client ; un document oublié lui coûte
-- son conteneur. Les deux erreurs sont graves, on ne masque ni l'une ni
-- l'autre derrière une liste d'apparence savante.
-- ---------------------------------------------------------------------------

create table if not exists app_e08c374bc4_documents_procedure (
  code        text primary key,
  libelle     text not null,
  sigle       text,

  sens        text not null default 'import' check (sens in ('import', 'export', 'les_deux')),
  mode        text not null default 'tous'   check (mode in ('aerien', 'maritime', 'routier', 'tous')),

  emetteur    text,

  -- Le moment compte autant que le document. Un BSC pris après embarquement
  -- coûte une pénalité ; un certificat d'origine demandé après dédouanement
  -- ne sert plus à rien. L'ordre chronologique est donc porté par la donnée,
  -- pas laissé à la mémoire de celui qui monte le dossier.
  moment      text not null default 'avant_declaration' check (moment in (
                'prealable',            -- avant toute opération (code importateur…)
                'avant_embarquement',   -- doit exister avant que la marchandise parte
                'avant_declaration',    -- exigé pour déposer la déclaration
                'a_la_declaration',     -- produit au moment de la déclaration
                'apres_liquidation',    -- vient après le paiement des droits
                'a_la_livraison')),     -- clôt le dossier

  obligation  text not null default 'obligatoire' check (obligation in ('obligatoire', 'conditionnel')),
  -- Rempli seulement quand l'obligation est conditionnelle. En clair, lisible
  -- par un humain : c'est cette phrase que l'agent affiche au client.
  condition   text,

  -- Ce qui se passe si on l'oublie. C'est le champ qui fait agir : « il
  -- manque une pièce » ne déclenche rien, « sans lui la marchandise reste au
  -- port et le magasinage court » déclenche un appel.
  consequence_oubli text,

  delai_indicatif   text,
  cout_fcfa         numeric,

  reference   text,   -- le texte réglementaire, quand il est connu
  source      text,   -- d'où vient l'information
  verifie     boolean not null default false,

  ordre       integer not null default 100,
  actif       boolean not null default true,
  note        text
);

comment on table app_e08c374bc4_documents_procedure is
  'Les pièces exigibles d''un dossier de transit. « verifie » distingue ce qui '
  'est confirmé par une source officielle de ce qui attend la confirmation du '
  'fondateur : le moteur ne doit jamais présenter les deux sur le même ton.';

alter table app_e08c374bc4_documents_procedure enable row level security;
drop policy if exists "Documents lisibles" on app_e08c374bc4_documents_procedure;
create policy "Documents lisibles" on app_e08c374bc4_documents_procedure for select using (actif);
drop policy if exists "Documents admin" on app_e08c374bc4_documents_procedure;
create policy "Documents admin" on app_e08c374bc4_documents_procedure for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- ---------------------------------------------------------------------------
-- L'IMPORT
-- ---------------------------------------------------------------------------
insert into app_e08c374bc4_documents_procedure
  (code, libelle, sigle, sens, mode, emetteur, moment, obligation, condition,
   consequence_oubli, delai_indicatif, cout_fcfa, reference, source, verifie, ordre)
values

('CODE_IMPORTATEUR', 'Code importateur/exportateur', null, 'les_deux', 'tous',
 'Ministère du Commerce / GUCE', 'prealable', 'obligatoire', null,
 'Sans code, aucune opération du commerce extérieur n''est possible : ni FDI, ni déclaration.',
 'À obtenir une fois, valable durablement', null, null,
 'Guichet Unique du Commerce Extérieur (GUCE)', true, 10),

('FDI', 'Fiche de Déclaration à l''Importation', 'FDI', 'import', 'tous',
 'GUCE — à partir du Dossier Virtuel de Transaction (DVT)', 'avant_declaration', 'obligatoire', null,
 'Sans FDI, la déclaration en douane ne peut pas être déposée : le dossier ne démarre pas.',
 'Disponible dès que le DVT passe en « VALIDE » — validité 3 mois renouvelable', 20000, null,
 'GUCE / PWIC — la FDI remplace la FRI et la DAI', true, 20),

('RFCV', 'Rapport Final de Classification et de Valeur', 'RFCV', 'import', 'tous',
 'Webb Fontaine / DARRV, via le GUCE', 'avant_declaration', 'conditionnel',
 'Valeur FOB supérieure ou égale à 1 000 000 FCFA.',
 'Sans RFCV, la déclaration est irrecevable. La marchandise attend au port ou à l''aéroport, et le magasinage court pendant ce temps.',
 'Environ 5 jours ouvrés après dépôt du dossier complet', 30000,
 'Circulaire douanière n° 1618 du 21 juin 2013',
 'GUCE / PWIC', true, 30),

('AD_VALEUR', 'Attestation de Valeur', 'AD', 'import', 'tous',
 'GUCE', 'avant_declaration', 'conditionnel',
 'Valeur FOB inférieure à 1 000 000 FCFA — elle tient lieu de RFCV.',
 'Sans elle, une petite importation se retrouve traitée comme un dossier sans valeur déclarée.',
 null, null, null, 'GUCE / PWIC', true, 31),

('FACTURE_COMMERCIALE', 'Facture commerciale du fournisseur', null, 'les_deux', 'tous',
 'Le fournisseur', 'avant_declaration', 'obligatoire', null,
 'C''est la pièce qui fonde la valeur en douane. Sans elle, la valeur est reconstituée d''office, presque toujours au désavantage de l''importateur.',
 null, null, null, 'Pratique constante du dédouanement', true, 40),

('FACTURE_FRET', 'Facture de fret', null, 'import', 'tous',
 'La compagnie ou le groupeur', 'avant_declaration', 'obligatoire', null,
 'Le fret entre dans la valeur CAF. Sans justificatif, la douane retient un forfait, généralement plus élevé que le fret réel.',
 null, null, null, 'Pratique constante du dédouanement', true, 41),

('ATTESTATION_ASSURANCE', 'Attestation d''assurance des facultés', null, 'import', 'tous',
 'Compagnie d''assurance agréée en Côte d''Ivoire', 'avant_declaration', 'obligatoire', null,
 'L''assurance à l''import doit être souscrite localement. À défaut, la douane applique une assurance d''office, et le recours en cas d''avarie est perdu.',
 null, null, null, 'Code CIMA — assurance locale obligatoire à l''import', true, 42),

('TITRE_TRANSPORT', 'Titre de transport (LTA en aérien, connaissement en maritime)', 'LTA / B/L', 'les_deux', 'tous',
 'La compagnie', 'avant_declaration', 'obligatoire', null,
 'C''est le titre qui donne droit à la marchandise. Sans original ou sans télex release, pas d''échange, donc pas d''enlèvement.',
 null, null, null, 'Pratique constante du dédouanement', true, 43),

('LISTE_COLISAGE', 'Liste de colisage', 'Packing list', 'les_deux', 'tous',
 'Le fournisseur', 'avant_declaration', 'obligatoire', null,
 'Elle permet le contrôle à l''ouverture. Une liste absente ou fausse transforme une visite de routine en litige.',
 null, null, null, 'Pratique constante du dédouanement', true, 44),

('BSC', 'Bordereau de Suivi des Cargaisons', 'BSC / BESC', 'import', 'maritime',
 'Office Ivoirien des Chargeurs (OIC)', 'avant_embarquement', 'obligatoire', null,
 'Il se prend AVANT l''embarquement. Pris après, il coûte une pénalité — c''est l''oubli le plus fréquent et le plus cher du maritime.',
 'À ouvrir dès la réservation de fret', null, null,
 'Office Ivoirien des Chargeurs', true, 50),

('CERTIFICAT_ORIGINE', 'Certificat d''origine', null, 'les_deux', 'tous',
 'Chambre de commerce ou autorité du pays d''origine', 'avant_declaration', 'conditionnel',
 'Marchandise pouvant bénéficier d''un régime préférentiel : CEDEAO, APE avec l''Union européenne, ZLECAf.',
 'Sans certificat, le régime préférentiel tombe et le droit de douane de droit commun s''applique. C''est souvent la différence entre 0 % et 20 %.',
 null, null, null, 'Régimes préférentiels CEDEAO / APE / ZLECAf', true, 51),

('BURIDA', 'Autorisation préalable d''importation de supports son et image', 'BURIDA', 'import', 'tous',
 'Bureau Ivoirien du Droit d''Auteur (BURIDA), Ministère de la Culture', 'avant_embarquement', 'conditionnel',
 'Supports enregistrés : phonogrammes et vidéogrammes (CD, DVD, cartes mémoire préchargées, supports musicaux ou audiovisuels).',
 'Le Bon À Enlever n''est délivré qu''après examen du dossier par la douane ET intention d''importation du BURIDA. À la livraison, les supports sont conduits au BURIDA pour l''apposition des vignettes d''authentification : sans vignette, la marchandise est réputée piratée et peut être saisie.',
 'À demander avant l''expédition', null,
 'Arrêté interministériel n° 13 du 7 février 1984',
 'BURIDA / GUCE — PWIC, procédure « Support son et image »', true, 52),

('CERTIFICAT_PHYTO', 'Certificat phytosanitaire', null, 'les_deux', 'tous',
 'Ministère de l''Agriculture — protection des végétaux', 'avant_declaration', 'conditionnel',
 'Végétaux, produits végétaux, semences, bois.',
 'Sans certificat, la marchandise est bloquée en attente de contrôle, et peut être refoulée ou détruite.',
 null, null, null, 'Réglementation phytosanitaire nationale', true, 53),

('CERTIFICAT_SANITAIRE', 'Certificat sanitaire ou vétérinaire', null, 'les_deux', 'tous',
 'Services vétérinaires / Ministère de la Santé', 'avant_declaration', 'conditionnel',
 'Denrées alimentaires, produits d''origine animale, produits de la pêche.',
 'Contrôle systématique à l''arrivée. Une denrée sans certificat ne franchit pas la frontière.',
 null, null, null, 'Réglementation sanitaire nationale', true, 54),

('DECLARATION_DETAIL', 'Déclaration en détail', null, 'les_deux', 'tous',
 'Le commissionnaire en douane agréé partenaire', 'a_la_declaration', 'obligatoire', null,
 'C''est l''acte de dédouanement lui-même. La loi le réserve au commissionnaire agréé — MayLary Group ne le signe pas.',
 null, null, 'Code des douanes de Côte d''Ivoire',
 'Code des douanes — monopole du commissionnaire agréé pour la déclaration en détail', true, 60),

('QUITTANCE', 'Quittance de paiement des droits et taxes', null, 'les_deux', 'tous',
 'Douane / Trésor', 'apres_liquidation', 'obligatoire', null,
 'Preuve du paiement. Sans elle, pas de Bon À Enlever.',
 null, null, null, 'Pratique constante du dédouanement', true, 70),

('BAE', 'Bon À Enlever', 'BAE', 'les_deux', 'tous',
 'Douane', 'apres_liquidation', 'obligatoire', null,
 'C''est l''autorisation de sortie. Tant qu''il n''est pas délivré, la marchandise reste sous douane et le magasinage continue de courir.',
 null, null, null, 'Code des douanes', true, 71),

('BORDEREAU_LIVRAISON', 'Bordereau de livraison signé', null, 'les_deux', 'tous',
 'MayLary Group', 'a_la_livraison', 'obligatoire', null,
 'Il clôt le dossier. Sans bordereau signé, la livraison n''est pas prouvée et le dossier ne peut pas être archivé.',
 null, null, null, 'Procédure interne MayLary Group', true, 80),

-- ---------------------------------------------------------------------------
-- L'EXPORT
-- ---------------------------------------------------------------------------
('FDE', 'Fiche de Déclaration à l''Exportation', 'FDE', 'export', 'tous',
 'GUCE', 'avant_declaration', 'obligatoire', null,
 'Équivalent de la FDI dans l''autre sens : sans elle, pas de déclaration d''export.',
 null, null, null, 'GUCE', false, 21),

('AGREMENT_FILIERE', 'Agrément exportateur de filière réglementée', null, 'export', 'tous',
 'Conseil du Café-Cacao, Conseil Coton-Anacarde, selon la filière', 'prealable', 'conditionnel',
 'Cacao, café, noix de cajou, coton, hévéa.',
 'Ces filières supposent un agrément et des quotas. MayLary Group ne les traite pas encore : le dossier n''est pas monté, le client est orienté vers l''organisme compétent.',
 null, null, null, 'Filières réglementées — décision du fondateur de ne pas les traiter au démarrage', true, 55)

on conflict (code) do update set
  libelle = excluded.libelle, sigle = excluded.sigle, sens = excluded.sens,
  mode = excluded.mode, emetteur = excluded.emetteur, moment = excluded.moment,
  obligation = excluded.obligation, condition = excluded.condition,
  consequence_oubli = excluded.consequence_oubli, delai_indicatif = excluded.delai_indicatif,
  cout_fcfa = excluded.cout_fcfa, reference = excluded.reference,
  source = excluded.source, verifie = excluded.verifie, ordre = excluded.ordre;
