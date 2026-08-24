-- Deux modes d'acheminement, et une marge qui cesse de ne porter que l'article.
--
-- CE QUE LE FONDATEUR A CORRIGÉ
--
-- « Ne confondons pas les articles supportés par CJ pour le fret et ceux qu'il
-- ne supporte pas ; c'est eux qui doivent être supportés par le groupage. »
--
-- Il avait raison, et le relevé le montrait : sur 105 articles, 59 avaient un
-- fret RÉELLEMENT coté par CJ. Les 46 autres vivaient sur un forfait de
-- 3 000 F que j'avais posé faute de cotation — un bouchon, pas un tarif — ou
-- étaient simplement éteints, perdus dans un cul-de-sac.
--
-- `mode_acheminement` tranche : cj_ddp quand CJ a rendu un prix pour CET
-- article, groupage sinon. Les articles éteints faute de fret sont rallumés en
-- groupage : ce n'étaient pas des articles morts, mais des articles qui
-- attendaient le bon canal.
--
-- LA MARGE, LÀ OÙ IL Y A DE LA PLACE
--
-- « Il faut que j'aie une marge sur toute la chaîne, mais faudrait qu'on
-- équilibre de sorte à ce que les prix ne flambent pas. »
--
-- Les deux moitiés tiennent ensemble à une condition : ne pas prendre
-- uniformément.
--
--     l'article     40 %, inchangé
--     le fret CJ    0 % — il pèse déjà la moitié du ticket
--     le fret       30 % en groupage, où il tombe de 7 710 à ~209 F
--     le service    un montant FIXE par commande, pas par article
--     les taxes     jamais. C'est dû à l'État.
--
-- Le frais fixe est la vraie réponse : 2 000 F sur un panier de 31 000 F,
-- c'est 6 % que personne ne discute, quand 30 % d'un fret de 209 F
-- rapporteraient 63 F.
--
-- Mesuré sur l'article moyen : en express le client paie 19 838 F pour
-- 4 894 F de marge ; en groupage il paie 15 414 F pour 4 957 F. Il paie
-- 4 424 F de moins et la maison gagne davantage.
--
-- LE GARDE-FOU
--
-- `plafond_competitivite` rend « que les prix ne flambent pas » exécutable :
-- au-delà de trois fois le prix d'achat, l'article n'est pas publié. Un prix
-- invendable affiché apprend au visiteur que la maison est chère, et il ne
-- revient pas.

alter table public.app_e08c374bc4_produits
  add column if not exists mode_acheminement text not null default 'cj_ddp';

alter table public.app_e08c374bc4_produits
  drop constraint if exists app_e08c374bc4_produits_mode_acheminement_check;

alter table public.app_e08c374bc4_produits
  add constraint app_e08c374bc4_produits_mode_acheminement_check
  check (mode_acheminement in ('cj_ddp', 'groupage'));

update public.app_e08c374bc4_produits
set mode_acheminement = 'groupage'
where fret_source is distinct from 'cj_reel' or indisponible_motif is not null;

update public.app_e08c374bc4_produits
set actif = true, indisponible_motif = null
where indisponible_motif in ('fret_non_cote', 'fret_disproportionne')
  and mode_acheminement = 'groupage';

create index if not exists app_e08c374bc4_produits_mode_idx
  on public.app_e08c374bc4_produits (mode_acheminement) where actif;

alter table public.app_e08c374bc4_parametres_import
  add column if not exists marge_fret_cj numeric not null default 0,
  add column if not exists marge_fret_groupage numeric not null default 0.30,
  add column if not exists frais_service_fcfa numeric not null default 2000,
  add column if not exists plafond_competitivite numeric not null default 3;

-- Le mode descend jusqu'à la boutique : sans lui dans la vue publique, la
-- fiche ne peut pas dire au client si son article part demain ou attend une
-- campagne, et le panier ne peut pas séparer les deux files. C'est une
-- information de SERVICE, pas de coût.
create or replace view public.app_e08c374bc4_produits_public as
 SELECT p.id, p.enseigne_id, p.nom, p.description, p.prix_unitaire_fcfa,
    p.photos, p.categorie, p.unite_vente, p.stock_disponible,
    p.delai_livraison_estime, p.actif, p.espace, p.categorie_gp_id,
    p.quantite_minimum,
        CASE
            WHEN p.source_donnee = 'import_cj_dropshipping'::text THEN 'import_international'::text
            WHEN p.vendeur_id IS NOT NULL THEN 'vendeur_local'::text
            ELSE 'local'::text
        END AS origine,
    p.vendeur_id, v.nom_entreprise AS vendeur_nom, v.ville AS vendeur_ville,
    v.logo_url AS vendeur_logo, p.created_at, p.updated_at,
    p.canal_acheminement, p.poids_unitaire_g, p.volume_unitaire_cm3,
    p.mode_acheminement
   FROM app_e08c374bc4_produits p
     LEFT JOIN app_e08c374bc4_vendeurs v ON v.id = p.vendeur_id
  WHERE p.actif = true AND (p.vendeur_id IS NULL OR v.statut = 'valide'::text);
