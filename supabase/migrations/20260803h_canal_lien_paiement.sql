-- Troisième forme de canal : le lien de paiement.
--
-- Un compte marchand Wave donne un lien statique — `pay.wave.com/m/<marchand>`
-- — avant même la clé d'API. Le client l'ouvre et paie dans son application, ce
-- qui vaut mieux qu'un numéro recopié à la main : pas de faute de frappe sur le
-- destinataire, et le nom du marchand s'affiche à l'écran.
--
-- Ce n'est pas pour autant une passerelle. Un lien statique ne porte ni le
-- montant, ni la référence de commande, et ne déclenche aucun webhook : le
-- client saisit lui-même la somme, et le rapprochement reste manuel. D'où le
-- maintien de la déclaration avec référence ou reçu — ce canal la rend plus
-- facile, il ne la remplace pas.
alter table app_e08c374bc4_canaux_paiement
  drop constraint if exists app_e08c374bc4_canaux_paiement_type_canal_check;

alter table app_e08c374bc4_canaux_paiement
  add constraint app_e08c374bc4_canaux_paiement_type_canal_check
  check (type_canal in ('mobile_money', 'virement', 'lien_paiement'));

-- `numero` porte l'URL quand le canal est un lien. Le champ garde son nom : le
-- renommer imposerait de toucher toutes les lectures pour un gain nul.
alter table app_e08c374bc4_canaux_paiement
  drop constraint if exists app_e08c374bc4_canaux_lien_https;

-- Un lien de paiement en clair exposerait le client à une interception sur un
-- réseau public. Le refuser en base plutôt que d'espérer que personne ne le
-- saisisse.
alter table app_e08c374bc4_canaux_paiement
  add constraint app_e08c374bc4_canaux_lien_https
  check (type_canal <> 'lien_paiement' or numero like 'https://%');

-- Le titulaire n'a pas de sens pour un lien : c'est la page du marchand qui
-- affiche son propre nom.
alter table app_e08c374bc4_canaux_paiement
  alter column titulaire drop not null;
