-- Comptabilisation automatique d'une commande, et ce qu'il a fallu corriger
-- avant de pouvoir le faire honnêtement.
--
-- Le coût d'achat d'un article vit sur la fiche produit, et cette fiche est
-- retarifée quand le fournisseur change ses prix. Une écriture d'achat calculée
-- sur la fiche d'aujourd'hui pour une commande de mars donnerait une marge
-- fausse — et une comptabilité fausse est pire qu'une absence de comptabilité,
-- parce qu'on s'y fie.
--
-- Le coût est donc figé sur la ligne de commande au moment où elle est créée.
alter table app_e08c374bc4_lignes_commande_gp
  add column if not exists cout_achat_fcfa     numeric,
  add column if not exists cout_fret_fcfa      numeric,
  add column if not exists cout_assurance_fcfa numeric;

comment on column app_e08c374bc4_lignes_commande_gp.cout_achat_fcfa is
  'Coût unitaire figé à la commande. Nul sur les commandes antérieures : la comptabilisation retombe alors sur la fiche produit, avec la mention correspondante.';

-- ---------------------------------------------------------------------------
-- Comptabilisation
-- ---------------------------------------------------------------------------
-- Trois écritures par commande confirmée, parce que ce sont trois faits
-- distincts qui n'arrivent pas forcément le même jour :
--   la vente (créance sur le client), l'encaissement (la créance s'éteint),
--   et l'achat (ce que la marchandise nous a coûté).
--
-- Le cas marketplace est traité à part, et c'est le point qui distingue une
-- comptabilité juste d'une addition : sur l'article d'un vendeur tiers, le
-- chiffre d'affaires de Maylary n'est pas le prix payé par le client, c'est la
-- seule commission. Le reste est une dette envers le vendeur. Confondre les
-- deux gonflerait le chiffre d'affaires de tout ce qui ne nous appartient pas.
create or replace function app_e08c374bc4_comptabiliser_commande(p_commande uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cmd            record;
  v_ecriture       uuid;
  v_march_maylary  numeric := 0;
  v_commission     numeric := 0;
  v_net_vendeur    numeric := 0;
  v_livraison      numeric := 0;
  v_remise         numeric := 0;
  v_encaisse       numeric := 0;
  v_compte_treso   text;
  v_achat          numeric := 0;
  v_fret           numeric := 0;
  v_assurance      numeric := 0;
  v_cout_estime    boolean := false;
  v_creees         integer := 0;
begin
  -- Tenir les livres est un acte de gestion. Sans ce contrôle, une fonction
  -- `security definer` laisse n'importe quel compte connecté passer des
  -- écritures — vérifié avant correctif : un client ordinaire en a créé trois.
  -- Retirer le privilège EXECUTE ne conviendrait pas, l'écran d'administration
  -- appelle la fonction avec le même rôle `authenticated` que tout le monde.
  --
  -- `auth.uid() is null` laisse passer la clé de service, dont se servent les
  -- fonctions de bord et les reprises administratives.
  if auth.uid() is not null and not app_e08c374bc4_is_admin() then
    raise exception 'Seule l''administration tient la comptabilité.'
      using errcode = '42501';
  end if;

  select * into v_cmd from app_e08c374bc4_commandes_gp where id = p_commande;
  if not found then
    raise exception 'Commande % introuvable.', p_commande;
  end if;

  -- Idempotence : comptabiliser deux fois la même commande doublerait le
  -- chiffre d'affaires. Un bouton cliqué deux fois ne doit rien casser.
  if exists (select 1 from app_e08c374bc4_ecritures
             where source_type = 'commande_gp' and source_id = p_commande) then
    return 0;
  end if;

  select
    coalesce(sum(l.sous_total) filter (where l.vendeur_id is null), 0),
    coalesce(sum(l.commission_fcfa), 0),
    coalesce(sum(l.net_vendeur_fcfa), 0),
    coalesce(sum(coalesce(l.cout_achat_fcfa, p.prix_achat_fcfa, 0) * l.quantite)
             filter (where l.vendeur_id is null), 0),
    coalesce(sum(coalesce(l.cout_fret_fcfa, p.cout_fret_fcfa, 0) * l.quantite)
             filter (where l.vendeur_id is null), 0),
    coalesce(sum(coalesce(l.cout_assurance_fcfa, p.cout_assurance_fcfa, 0) * l.quantite)
             filter (where l.vendeur_id is null), 0),
    coalesce(bool_or(l.cout_achat_fcfa is null and l.vendeur_id is null), false)
  into v_march_maylary, v_commission, v_net_vendeur, v_achat, v_fret, v_assurance, v_cout_estime
  from app_e08c374bc4_lignes_commande_gp l
  left join app_e08c374bc4_produits p on p.id = l.produit_id
  where l.commande_id = p_commande;

  v_livraison := coalesce(v_cmd.supplement_transporteur_fcfa, 0);
  v_remise    := coalesce(v_cmd.remise_groupage_fcfa, 0);
  v_encaisse  := coalesce(v_cmd.montant_recu_fcfa, v_cmd.montant_total_fcfa, 0);

  -- Le compte de trésorerie suit le canal réellement utilisé, pas le mode
  -- déclaré à la commande : le client annonce « mobile money » puis règle par
  -- virement, et c'est le virement qui touche le compte.
  v_compte_treso := case
    when coalesce(v_cmd.canal_paiement_declare, '') ilike '%virement%'
      or coalesce(v_cmd.canal_paiement_declare, '') ilike '%banque%'
      or coalesce(v_cmd.canal_paiement_declare, '') ilike '%generale%'
      or coalesce(v_cmd.canal_paiement_declare, '') ilike '%générale%'
      or v_cmd.mode_paiement = 'virement' then '521000'
    else '551000'
  end;

  -- 1. La vente ------------------------------------------------------------
  insert into app_e08c374bc4_ecritures (journal, libelle, piece, source_type, source_id, date_ecriture)
  values ('VE', 'Vente ' || coalesce(v_cmd.reference_publique, p_commande::text),
          v_cmd.reference_publique, 'commande_gp', p_commande,
          coalesce(v_cmd.created_at::date, current_date))
  returning id into v_ecriture;

  insert into app_e08c374bc4_lignes_ecriture (ecriture_id, compte, libelle, debit_fcfa, ordre)
  values (v_ecriture, '411000', 'Créance client', round(v_cmd.montant_total_fcfa), 0);

  if round(v_march_maylary - v_remise) > 0 then
    insert into app_e08c374bc4_lignes_ecriture (ecriture_id, compte, libelle, credit_fcfa, ordre)
    values (v_ecriture, '701000', 'Marchandises vendues', round(v_march_maylary - v_remise), 1);
  end if;

  if round(v_commission + v_livraison) > 0 then
    insert into app_e08c374bc4_lignes_ecriture (ecriture_id, compte, libelle, credit_fcfa, ordre)
    values (v_ecriture, '706000',
            case when v_commission > 0 then 'Commission marketplace et livraison facturée'
                 else 'Livraison facturée' end,
            round(v_commission + v_livraison), 2);
  end if;

  if round(v_net_vendeur) > 0 then
    insert into app_e08c374bc4_lignes_ecriture (ecriture_id, compte, libelle, credit_fcfa, ordre)
    values (v_ecriture, '401000', 'Dû aux vendeurs marketplace', round(v_net_vendeur), 3);
  end if;

  v_creees := v_creees + 1;

  -- 2. L'encaissement ------------------------------------------------------
  if v_encaisse > 0 then
    insert into app_e08c374bc4_ecritures (journal, libelle, piece, source_type, source_id, date_ecriture)
    values (case when v_compte_treso = '521000' then 'BQ' else 'MM' end,
            'Encaissement ' || coalesce(v_cmd.reference_publique, p_commande::text),
            coalesce(v_cmd.reference_transaction, v_cmd.reference_publique),
            'commande_gp', p_commande,
            coalesce(v_cmd.paiement_confirme_le::date, current_date))
    returning id into v_ecriture;

    insert into app_e08c374bc4_lignes_ecriture (ecriture_id, compte, libelle, debit_fcfa, ordre)
    values (v_ecriture, v_compte_treso, 'Règlement reçu', round(v_encaisse), 0);
    insert into app_e08c374bc4_lignes_ecriture (ecriture_id, compte, libelle, credit_fcfa, ordre)
    values (v_ecriture, '411000', 'Extinction de la créance', round(v_encaisse), 1);

    v_creees := v_creees + 1;
  end if;

  -- 3. L'achat -------------------------------------------------------------
  if round(v_achat + v_fret + v_assurance) > 0 then
    insert into app_e08c374bc4_ecritures (journal, libelle, piece, source_type, source_id, date_ecriture)
    values ('AC',
            'Achat fournisseur ' || coalesce(v_cmd.reference_publique, p_commande::text)
            || case when v_cout_estime then ' (coût estimé sur la fiche produit)' else '' end,
            coalesce(v_cmd.reference_fournisseur, v_cmd.reference_publique),
            'commande_gp', p_commande,
            coalesce(v_cmd.envoye_fournisseur_le::date, v_cmd.created_at::date, current_date))
    returning id into v_ecriture;

    if round(v_achat) > 0 then
      insert into app_e08c374bc4_lignes_ecriture (ecriture_id, compte, libelle, debit_fcfa, ordre)
      values (v_ecriture, '601000', 'Marchandises', round(v_achat), 0);
    end if;
    if round(v_fret) > 0 then
      insert into app_e08c374bc4_lignes_ecriture (ecriture_id, compte, libelle, debit_fcfa, ordre)
      values (v_ecriture, '611000', 'Fret international', round(v_fret), 1);
    end if;
    if round(v_assurance) > 0 then
      insert into app_e08c374bc4_lignes_ecriture (ecriture_id, compte, libelle, debit_fcfa, ordre)
      values (v_ecriture, '625000', 'Assurance facultés', round(v_assurance), 2);
    end if;
    insert into app_e08c374bc4_lignes_ecriture (ecriture_id, compte, libelle, credit_fcfa, ordre)
    values (v_ecriture, '401000', 'Dette fournisseur', round(v_achat + v_fret + v_assurance), 3);

    v_creees := v_creees + 1;
  end if;

  return v_creees;
end;
$$;

revoke execute on function app_e08c374bc4_comptabiliser_commande(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Restitutions
-- ---------------------------------------------------------------------------
-- Toutes réservées à l'administrateur : ce sont les comptes de l'entreprise.
create or replace view app_e08c374bc4_balance as
select c.code, c.libelle, c.classe, c.sens,
       coalesce(sum(l.debit_fcfa), 0)  as total_debit,
       coalesce(sum(l.credit_fcfa), 0) as total_credit,
       coalesce(sum(l.debit_fcfa), 0) - coalesce(sum(l.credit_fcfa), 0) as solde
from app_e08c374bc4_comptes c
left join app_e08c374bc4_lignes_ecriture l on l.compte = c.code
where app_e08c374bc4_is_admin()
group by c.code, c.libelle, c.classe, c.sens
having coalesce(sum(l.debit_fcfa), 0) <> 0 or coalesce(sum(l.credit_fcfa), 0) <> 0;

alter view app_e08c374bc4_balance set (security_invoker = true);

create or replace view app_e08c374bc4_grand_livre as
select l.id, e.numero, e.date_ecriture, e.journal, e.libelle as ecriture_libelle,
       e.piece, e.source_type, e.source_id,
       l.compte, c.libelle as compte_libelle, l.libelle as ligne_libelle,
       l.debit_fcfa, l.credit_fcfa, l.ordre
from app_e08c374bc4_lignes_ecriture l
join app_e08c374bc4_ecritures e on e.id = l.ecriture_id
join app_e08c374bc4_comptes c on c.code = l.compte
where app_e08c374bc4_is_admin();

alter view app_e08c374bc4_grand_livre set (security_invoker = true);

-- Compte de résultat : les charges se lisent au débit, les produits au crédit.
-- Le résultat est la différence, et rien d'autre.
create or replace view app_e08c374bc4_compte_resultat as
select c.classe,
       case c.classe when 6 then 'Charges' when 7 then 'Produits' end as nature,
       c.code, c.libelle,
       case c.classe
         when 6 then coalesce(sum(l.debit_fcfa), 0) - coalesce(sum(l.credit_fcfa), 0)
         else coalesce(sum(l.credit_fcfa), 0) - coalesce(sum(l.debit_fcfa), 0)
       end as montant
from app_e08c374bc4_comptes c
left join app_e08c374bc4_lignes_ecriture l on l.compte = c.code
where c.classe in (6, 7) and app_e08c374bc4_is_admin()
group by c.classe, c.code, c.libelle
having coalesce(sum(l.debit_fcfa), 0) <> 0 or coalesce(sum(l.credit_fcfa), 0) <> 0;

alter view app_e08c374bc4_compte_resultat set (security_invoker = true);
