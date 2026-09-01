-- Les déclinaisons : un article, plusieurs tailles et plusieurs couleurs.
--
-- LE DÉFAUT, MESURÉ AVANT D'ÉCRIRE UNE LIGNE
--
-- Un article du catalogue ne portait qu'UNE référence de déclinaison,
-- `produits.reference_variante`, prise arbitrairement sur la PREMIÈRE que le
-- fournisseur renvoyait.
--
-- Relevé le 31 août sur « Robe fleurie col V » : le fournisseur en propose
-- QUINZE — trois couleurs (Blue, Red, Color) fois cinq tailles (S, M, L, XL,
-- 2XL). Nous vendions « Color-S ». Toute cliente qui commandait cette robe
-- aurait reçu un S, quelle que soit sa taille.
--
-- Et le défaut allait jusqu'au bout de la chaîne : la ligne de commande ne
-- portait ni taille ni couleur, et `cj_commande` transmettait au fournisseur la
-- référence unique du produit. Le client ne pouvait pas choisir, et rien
-- n'aurait transporté son choix s'il avait pu.
--
-- UNE BONNE NOUVELLE, VÉRIFIÉE PLUTÔT QUE SUPPOSÉE
--
-- Les quinze déclinaisons de cette robe ont TOUTES le même prix d'achat
-- (4 482 FCFA). Nos prix de vente ne sont donc pas faussés — c'est le choix qui
-- manquait, pas le calcul. La table garde tout de même un prix par déclinaison :
-- rien ne garantit que ce soit vrai partout, et une grande taille coûte parfois
-- plus cher.
--
-- CE QUE LE VISITEUR NE DOIT JAMAIS VOIR
--
-- La référence de déclinaison est un identifiant FOURNISSEUR, et le prix
-- d'achat est un coût de revient. Ni l'un ni l'autre ne sortent : la table est
-- fermée par RLS, et la vitrine lit une VUE qui ne porte que le libellé, la
-- couleur, la taille et la photo. Même schéma que `produits_public`.

create table if not exists app_e08c374bc4_declinaisons (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references app_e08c374bc4_produits(id) on delete cascade,

  -- Identifiant chez le fournisseur. C'est LUI qu'on transmet à la commande :
  -- sans lui, le fournisseur ne sait pas quelle taille préparer.
  reference_variante text not null,

  -- La clé brute telle que le fournisseur l'écrit, par exemple « Color-S ».
  -- Conservée telle quelle : quand l'analyse automatique se trompe, c'est elle
  -- qui permet de comprendre pourquoi sans redemander au fournisseur.
  cle_source text,

  -- Résultat de l'analyse. `couleur` garde le mot d'origine, `couleur_fr` porte
  -- la traduction affichée. Les deux, parce qu'une traduction approximative ne
  -- doit jamais effacer la donnée d'origine.
  couleur text,
  couleur_fr text,
  taille text,

  prix_achat_fcfa numeric,
  poids_g numeric,
  volume_cm3 numeric,

  -- Le fournisseur donne une photo PAR déclinaison : c'est elle qui montre la
  -- vraie couleur, bien mieux qu'une pastille de couleur devinée.
  photo_url text,

  ordre integer not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (produit_id, reference_variante)
);

create index if not exists idx_declinaisons_produit on app_e08c374bc4_declinaisons(produit_id);

alter table app_e08c374bc4_declinaisons enable row level security;

create policy declinaisons_admin_tout on app_e08c374bc4_declinaisons
  for all to authenticated
  using ((select app_e08c374bc4_is_admin()))
  with check ((select app_e08c374bc4_is_admin()));

-- Savoir quels articles ont déjà été interrogés. Vide = jamais demandé, et
-- c'est exactement ce que le releveur cherche.
alter table app_e08c374bc4_produits
  add column if not exists declinaisons_relevees_le timestamptz;

-- La ligne de commande transporte le choix du client.
--
-- `declinaison_id` sert à la commande fournisseur. `declinaison_libelle` est
-- une COPIE du texte au moment de l'achat : si l'article change ou disparaît
-- plus tard, la facture et le bon de préparation doivent continuer de dire ce
-- qui a été commandé. Un identifiant seul ne survit pas à une suppression.
alter table app_e08c374bc4_lignes_commande_gp
  add column if not exists declinaison_id uuid references app_e08c374bc4_declinaisons(id) on delete set null,
  add column if not exists declinaison_libelle text;

create or replace view app_e08c374bc4_declinaisons_public as
  select d.id,
         d.produit_id,
         d.couleur_fr,
         d.taille,
         -- Le libellé prêt à afficher, sans que la vitrine ait à le composer.
         nullif(trim(both ' ' from concat_ws(' — ', d.couleur_fr, d.taille)), '') as libelle,
         d.photo_url,
         d.ordre
    from app_e08c374bc4_declinaisons d
    join app_e08c374bc4_produits p on p.id = d.produit_id
   where d.actif = true
     and p.actif = true;

grant select on app_e08c374bc4_declinaisons_public to anon, authenticated;
