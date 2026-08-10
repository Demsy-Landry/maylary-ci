-- L'origine d'une marchandise, et ce qu'elle change au droit de douane.
--
-- Jusqu'ici l'application ne savait pas d'où venait ce qu'elle chiffrait. Elle
-- appliquait le TEC plein, ce qui est juste pour la Chine et faux pour l'Europe
-- depuis que la quatrième phase du démantèlement APE est entrée en vigueur au
-- 1er janvier 2026 — 1 074 lignes tarifaires de plus à droit nul pour les
-- produits originaires de l'Union européenne.
--
-- Une règle tient tout ce fichier : **le régime décrit une possibilité, jamais
-- un droit acquis**. Une exonération ne s'obtient qu'avec la preuve d'origine
-- (EUR.1, certificat ZLECAf, certificat CEDEAO). Sans elle, tarif plein. Le
-- moteur ne baissera donc aucun taux tant que la liste officielle des positions
-- concernées ne sera pas chargée — `positions_confirmees` reste faux, et un
-- taux non vérifié ne s'affiche pas. C'est la même discipline que pour le TEC.

create table if not exists app_e08c374bc4_regimes_origine (
  code                 text primary key,
  libelle              text not null,
  zone                 text not null,
  -- Le papier sans lequel la préférence n'existe pas.
  document_requis      text,
  base_legale          text,
  -- Faux tant que la liste officielle des positions exonérées n'est pas
  -- chargée. Le moteur refuse d'appliquer une réduction sans elle.
  positions_confirmees boolean not null default false,
  -- Ce que coûte l'obtention de la preuve, tout compris : frais de chambre de
  -- commerce, temps du fournisseur, retard. À renseigner par l'exploitation ;
  -- c'est ce chiffre qui décide si la démarche vaut la peine.
  cout_preuve_fcfa     numeric,
  delai_preuve_jours   integer,
  ordre                integer not null default 100,
  actif                boolean not null default true,
  note                 text
);

insert into app_e08c374bc4_regimes_origine
  (code, libelle, zone, document_requis, base_legale, ordre, note) values
  ('droit_commun', 'Droit commun (TEC CEDEAO)', 'Reste du monde', null,
   'Tarif Extérieur Commun UEMOA/CEDEAO', 10,
   'Le cas par défaut. Chine, Turquie, Inde, États-Unis : aucune préférence, le TEC s''applique en entier.'),
  ('ape_ue', 'APE Côte d''Ivoire – Union européenne', 'Union européenne',
   'EUR.1 ou déclaration d''origine sur facture (exportateur agréé)',
   'APE signé 2007, appliqué depuis 2016. Démantèlement en 5 phases 2019-2029 ; phase 4 en vigueur au 1er janvier 2026, 1 074 lignes tarifaires supplémentaires exonérées.',
   20,
   'La plus grosse opportunité et la plus mal exploitée. Beaucoup de fournisseurs européens ignorent la procédure EUR.1 : savoir la demander est un avantage concurrentiel. Reste à charger la liste officielle des positions par phase, à obtenir auprès de la DGD.'),
  ('zlecaf', 'ZLECAf — zone de libre-échange continentale africaine', 'Afrique',
   'Certificat d''origine ZLECAf',
   'Accord ZLECAf. La Tunisie délivre déjà des certificats nommément pour la Côte d''Ivoire.',
   30,
   'Maroc, Tunisie, Égypte, Kenya. Élimination visée sur 90 % des lignes. Le déploiement est progressif : vérifier au cas par cas que la position et le pays sont couverts.'),
  ('cedeao', 'Schéma de libéralisation des échanges CEDEAO', 'CEDEAO',
   'Certificat d''origine CEDEAO + numéro d''entreprise agréée',
   'Schéma de libéralisation des échanges de la CEDEAO',
   40,
   'L''origine la moins chère de toutes : Ghana, Nigeria, Sénégal, Togo, Bénin. Droit nul pour les produits du cru et les produits industriels agréés. Le Ghana est à une journée de route — cette piste mérite d''être creusée avant l''Asie.')
on conflict (code) do nothing;

alter table app_e08c374bc4_regimes_origine enable row level security;
drop policy if exists "Régimes d'origine lisibles" on app_e08c374bc4_regimes_origine;
create policy "Régimes d'origine lisibles" on app_e08c374bc4_regimes_origine for select using (true);
drop policy if exists "Régimes d'origine admin" on app_e08c374bc4_regimes_origine;
create policy "Régimes d'origine admin" on app_e08c374bc4_regimes_origine for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

-- La fiche fournisseur ne portait que nom, contact, fiabilité et secteur. De
-- quoi noter un carnet d'adresses, pas de quoi comparer deux origines.
alter table app_e08c374bc4_fournisseurs
  add column if not exists pays                     text,
  add column if not exists ville                    text,
  add column if not exists regime_origine           text references app_e08c374bc4_regimes_origine (code),
  -- La question éliminatoire : sans preuve d'origine, la préférence n'existe
  -- pas, quel que soit le pays du fournisseur.
  add column if not exists preuve_origine           text not null default 'inconnu'
    check (preuve_origine in ('inconnu', 'oui', 'non', 'sur_demande')),
  add column if not exists incoterm_defaut          text,
  add column if not exists devise                   text not null default 'EUR',
  add column if not exists delai_production_jours   integer,
  add column if not exists delai_transport_jours    integer,
  add column if not exists minimum_commande_fcfa    numeric,
  add column if not exists mode_transport           text,
  add column if not exists site_web                 text,
  add column if not exists modele                   text not null default 'gros'
    check (modele in ('gros', 'dropshipping', 'annuaire', 'organisme')),
  add column if not exists note                     text;

comment on column app_e08c374bc4_fournisseurs.preuve_origine is
  'Le fournisseur sait-il produire EUR.1 / certificat ZLECAf / certificat CEDEAO ? Sans cette preuve, aucune préférence tarifaire, quel que soit le pays.';
comment on column app_e08c374bc4_fournisseurs.modele is
  'gros : achat EXW/FOB puis groupage et dédouanement par nos soins — c''est là que l''agrément de commissionnaire rapporte. dropshipping : colis à l''unité, aucune preuve d''origine possible. annuaire / organisme : une porte d''entrée, pas un fournisseur.';

/** Un montant en FCFA lisible : espace en séparateur de milliers, pas virgule. */
create or replace function app_e08c374bc4_montant_fcfa(p numeric)
returns text language sql immutable
set search_path = public
as $$ select translate(to_char(p, 'FM999G999G999'), ',', ' ') $$;

/**
 * L'arbitrage que le fondateur a nommé : la preuve d'origine vaut-elle la
 * peine qu'on la demande ?
 *
 * « Certains importateurs n'ont pas le temps de faire un APE, sauf quand le
 * montant est très élevé. » C'est exact, et c'est calculable. L'économie croît
 * avec la valeur en douane ; le coût de la démarche, lui, est à peu près fixe.
 * Il existe donc un montant à partir duquel elle devient rentable, et en
 * dessous duquel courir après un EUR.1 fait perdre plus qu'il ne rapporte.
 */
create or replace function app_e08c374bc4_arbitrage_origine(
  p_caf_fcfa          numeric,
  p_taux_dd           numeric,             -- 0.20 pour 20 %
  p_cout_preuve_fcfa  numeric default null,
  p_delai_preuve_jours integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_economie numeric;
  v_cout     numeric := coalesce(p_cout_preuve_fcfa, 0);
  v_seuil    numeric;
begin
  if p_caf_fcfa is null or p_taux_dd is null then
    return jsonb_build_object(
      'calculable', false,
      'motif', 'Valeur en douane ou taux de droit inconnu : aucun arbitrage possible.');
  end if;

  -- Une marchandise qui ne paie aucun droit n'a rien à économiser. Le dire
  -- franchement évite d'envoyer un client courir après un papier inutile.
  if p_taux_dd = 0 then
    return jsonb_build_object(
      'calculable', true,
      'economie_droits_fcfa', 0,
      'verdict', 'sans_objet',
      'message', 'Cette marchandise ne supporte déjà aucun droit de douane : la preuve d''origine n''apporterait rien.');
  end if;

  -- L'économie porte sur le droit de douane seul. La TVA se calcule sur
  -- (CAF + DD + RST) : un droit qui tombe fait donc aussi baisser la TVA, mais
  -- cette part-là n'est pas un gain pour un assujetti qui la récupère. On ne
  -- compte que ce qui est réellement gagné dans tous les cas.
  v_economie := round(p_caf_fcfa * p_taux_dd);

  if p_cout_preuve_fcfa is null then
    return jsonb_build_object(
      'calculable', true,
      'economie_droits_fcfa', v_economie,
      'cout_preuve_connu', false,
      'verdict', 'a_chiffrer',
      'message', format(
        'La préférence ferait économiser %s FCFA de droits. Reste à connaître ce que coûte l''obtention de la preuve d''origine pour trancher.',
        app_e08c374bc4_montant_fcfa(v_economie)));
  end if;

  v_seuil := round(v_cout / p_taux_dd);

  return jsonb_build_object(
    'calculable', true,
    'economie_droits_fcfa', v_economie,
    'cout_preuve_connu', true,
    'cout_preuve_fcfa', v_cout,
    'gain_net_fcfa', v_economie - v_cout,
    'seuil_rentabilite_caf_fcfa', v_seuil,
    'delai_supplementaire_jours', p_delai_preuve_jours,
    'verdict', case when v_economie > v_cout then 'vaut_la_peine' else 'ne_vaut_pas_la_peine' end,
    'message', case
      when v_economie > v_cout then format(
        'Oui : %s FCFA de droits économisés pour %s FCFA de démarche, soit %s FCFA nets.%s',
        app_e08c374bc4_montant_fcfa(v_economie), app_e08c374bc4_montant_fcfa(v_cout),
        app_e08c374bc4_montant_fcfa(v_economie - v_cout),
        case when p_delai_preuve_jours is not null
             then format(' Compter %s jours de plus.', p_delai_preuve_jours) else '' end)
      else format(
        'Non : %s FCFA économisés pour %s FCFA de démarche. La préférence devient rentable au-delà de %s FCFA de valeur en douane.',
        app_e08c374bc4_montant_fcfa(v_economie), app_e08c374bc4_montant_fcfa(v_cout),
        app_e08c374bc4_montant_fcfa(v_seuil))
    end);
end;
$$;

-- Liste blanche, conformément à 20260810a : seule la fonction d'arbitrage est
-- appelable depuis le navigateur.
revoke all on function app_e08c374bc4_montant_fcfa(numeric) from public, anon, authenticated;
grant execute on function app_e08c374bc4_montant_fcfa(numeric) to service_role;
revoke all on function app_e08c374bc4_arbitrage_origine(numeric, numeric, numeric, integer)
  from public, anon, authenticated;
grant execute on function app_e08c374bc4_arbitrage_origine(numeric, numeric, numeric, integer)
  to anon, authenticated, service_role;
