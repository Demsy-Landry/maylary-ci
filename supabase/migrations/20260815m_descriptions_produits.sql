-- ---------------------------------------------------------------------------
-- Les fiches produit étaient muettes : 94 articles sur 94 sans une ligne.
--
-- Le fondateur : « tous les articles doivent fournir une description plus
-- précise avec tous les détails disponibles comme sur CJ ».
--
-- Ce que le fournisseur donne et qu'on jetait à chaque import : deux à trois
-- mille caractères de description, la matière, l'emballage, le poids net. On
-- n'extrayait que l'identifiant de variante, le prix, le poids et le volume.
--
-- DEUX CHAMPS, ET POURQUOI PAS UN SEUL
--
-- `description` est ce que le client lit, et le fondateur doit pouvoir la
-- réécrire. `description_fournisseur` garde le texte brut de CJ, en anglais.
-- Les séparer évite le piège : une réécriture n'efface pas la source, et un
-- réimport n'efface pas le travail du fondateur.
-- ---------------------------------------------------------------------------

alter table app_e08c374bc4_produits
  add column if not exists description_fournisseur text,
  add column if not exists matiere               text,
  add column if not exists emballage             text,
  add column if not exists poids_produit_g       numeric,
  add column if not exists enrichi_le            timestamptz;

-- Le vocabulaire technique, traduit. On ne traduit QUE ce vocabulaire fermé —
-- matières et emballages — parce qu'il est court, répétitif et sans ambiguïté.
-- La description libre n'est pas traduite automatiquement : sur du vocabulaire
-- commercial, une traduction machine produit des phrases dont personne ne veut
-- sur une fiche de vente.
create or replace function app_e08c374bc4_traduire_terme(p_terme text)
returns text language sql immutable as $$
  select coalesce(
    (select t.fr from (values
      ('plastic','plastique'), ('metal','métal'), ('others','autres'), ('other','autre'),
      ('stainless steel','acier inoxydable'), ('steel','acier'), ('iron','fer'),
      ('aluminum','aluminium'), ('aluminium','aluminium'), ('alloy','alliage'),
      ('copper','cuivre'), ('zinc','zinc'), ('brass','laiton'), ('titanium','titane'),
      ('cotton','coton'), ('polyester','polyester'), ('nylon','nylon'),
      ('fabric','tissu'), ('linen','lin'), ('wool','laine'), ('velvet','velours'),
      ('leather','cuir'), ('pu leather','cuir synthétique'), ('rubber','caoutchouc'),
      ('silicone','silicone'), ('wood','bois'), ('bamboo','bambou'), ('mdf','panneau MDF'),
      ('glass','verre'), ('ceramic','céramique'), ('porcelain','porcelaine'),
      ('paper','papier'), ('cardboard','carton'),
      ('acrylic','acrylique'), ('sponge','éponge'), ('foam','mousse'),
      ('pvc','PVC'), ('abs','ABS'), ('pp','polypropylène'), ('pe','polyéthylène'),
      ('tpu','TPU'), ('eva','EVA'), ('resin','résine'), ('silica gel','gel de silice'),
      ('carbon fiber','fibre de carbone'), ('crystal','cristal'),
      ('carton','carton'), ('cartons','carton'), ('box','boîte'), ('boxes','boîte'),
      ('opp bag','sachet OPP'), ('opp bags','sachet OPP'),
      ('poly bag','sachet plastique'), ('poly bags','sachet plastique'),
      ('plastic bag','sachet plastique'), ('plastic bags','sachet plastique'),
      ('pe bag','sachet polyéthylène'), ('pe bags','sachet polyéthylène'),
      ('paper bag','sachet papier'), ('paper bags','sachet papier'),
      ('bubble bag','sachet à bulles'), ('bubble bags','sachet à bulles'),
      ('woven bag','sac tissé'), ('blister','blister'),
      ('paper box','boîte carton'), ('color box','boîte imprimée'),
      ('gift box','coffret cadeau'), ('bag','sachet'), ('bags','sachet'),
      ('none','sans emballage'), ('bulk','en vrac')
    ) as t(en, fr) where t.en = lower(btrim(p_terme))),
    btrim(p_terme));
$$;

-- Enrichir une fiche à partir de la réponse brute du fournisseur.
-- Elle ne touche JAMAIS à une description écrite à la main : c'est ce qui rend
-- l'opération rejouable sans crainte.
create or replace function app_e08c374bc4_enrichir_produit(p_id uuid, p_donnees jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p           app_e08c374bc4_produits;
  v_texte       text;
  v_matiere     text;
  v_emballage   text;
  v_poids       numeric;
  v_fiche       text;
  v_ecrite_main boolean;
begin
  select * into v_p from app_e08c374bc4_produits where id = p_id;
  if v_p.id is null then
    return jsonb_build_object('ok', false, 'motif', 'article introuvable');
  end if;

  -- Balises retirées, entités rétablies, blancs resserrés : une description
  -- pleine de « &amp; » et de <p> collés fait plus de mal que pas de
  -- description du tout.
  v_texte := regexp_replace(coalesce(p_donnees->>'description', ''), '<[^>]+>', ' ', 'g');
  v_texte := replace(replace(replace(replace(v_texte, '&amp;', '&'), '&nbsp;', ' '),
                             '&quot;', '"'), '&#39;', '''');
  v_texte := btrim(regexp_replace(v_texte, '\s+', ' ', 'g'));
  v_texte := nullif(v_texte, '');

  select string_agg(app_e08c374bc4_traduire_terme(x), ', ') into v_matiere
    from jsonb_array_elements_text(
      case when jsonb_typeof(coalesce(p_donnees->'materialNameEn','null'::jsonb)) = 'array'
           then p_donnees->'materialNameEn'
           else coalesce(nullif(p_donnees->>'materialNameEn',''), '[]')::jsonb end) as x;

  select string_agg(app_e08c374bc4_traduire_terme(x), ', ') into v_emballage
    from jsonb_array_elements_text(
      case when jsonb_typeof(coalesce(p_donnees->'packingNameEn','null'::jsonb)) = 'array'
           then p_donnees->'packingNameEn'
           else coalesce(nullif(p_donnees->>'packingNameEn',''), '[]')::jsonb end) as x;

  v_poids := nullif(regexp_replace(coalesce(p_donnees->>'productWeight',''), '[^0-9.]', '', 'g'), '')::numeric;

  v_fiche := concat_ws(E'\n',
    case when v_matiere   is not null then 'Matière : ' || v_matiere end,
    case when v_emballage is not null then 'Emballage : ' || v_emballage end,
    case when v_poids     is not null then 'Poids : ' || round(v_poids) || ' g' end);
  v_fiche := nullif(v_fiche, '');

  v_ecrite_main := v_p.description is not null
                   and length(btrim(v_p.description)) >= 30
                   and v_p.description not like 'Matière :%'
                   and v_p.description not like 'Emballage :%'
                   and v_p.description not like 'Poids :%';

  update app_e08c374bc4_produits set
    description_fournisseur = coalesce(v_texte, description_fournisseur),
    matiere                 = coalesce(v_matiere, matiere),
    emballage               = coalesce(v_emballage, emballage),
    poids_produit_g         = coalesce(v_poids, poids_produit_g),
    description             = case when v_ecrite_main then description
                                   else coalesce(v_fiche, description) end,
    enrichi_le              = now(),
    updated_at              = now()
  where id = p_id;

  return jsonb_build_object('ok', true, 'fiche', v_fiche is not null,
    'texte_fournisseur', length(coalesce(v_texte, '')),
    'description_preservee', v_ecrite_main);
end; $$;
revoke all on function app_e08c374bc4_enrichir_produit(uuid, jsonb) from public, anon, authenticated;
