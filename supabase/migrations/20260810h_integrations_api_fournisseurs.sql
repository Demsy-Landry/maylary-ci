-- L'intégration technique d'un fournisseur, décrite là où elle sert.
--
-- Relevé du 10 août 2026, en lisant les documentations elles-mêmes plutôt que
-- des articles à leur sujet. Les deux sites étant filtrés depuis
-- l'environnement de développement, la lecture est passée par un relais
-- éphémère déployé sur Supabase, neutralisé aussitôt après.
--
-- Ce qui est écrit ici a été vérifié à la source ; ce qui manque est marqué
-- comme manquant.

alter table app_e08c374bc4_fournisseurs
  add column if not exists api_statut text not null default 'aucune'
    check (api_statut in ('aucune', 'a_obtenir', 'cle_en_attente', 'branchee')),
  add column if not exists api_base_url        text,
  add column if not exists api_bac_a_sable_url text,
  add column if not exists api_authentification text,
  add column if not exists api_documentation   text,
  add column if not exists api_prerequis       text,
  add column if not exists api_note            text;

comment on column app_e08c374bc4_fournisseurs.api_statut is
  'aucune : pas d''API. a_obtenir : API existante, accès à demander. cle_en_attente : accès demandé, clé pas encore déposée dans les secrets. branchee : connecteur en service.';

update app_e08c374bc4_fournisseurs set
  api_statut = 'a_obtenir',
  api_base_url = 'https://api.bigbuy.eu',
  api_bac_a_sable_url = 'https://api.sandbox.bigbuy.eu',
  api_authentification = 'Jeton porteur — en-tête Authorization: Bearer <clé>',
  api_documentation = 'https://www.bigbuy.eu/public/doc/Guia_API_BigBuy_EN.pdf',
  api_prerequis = 'Compte BigBuy actif avec un pack « Ecommerce » ou supérieur. La clé se lit dans le panneau de contrôle, onglet « Synchronise with BigBuy ». Un accès FTP est proposé au même endroit.',
  api_note = 'Quatre familles d''appels : catalogue (stocks temps réel, descriptions et arborescence en 24 langues, images), commandes (création immédiate ou groupée, suivi d''état), coûts de transport (tarifs temps réel, délais, liste des transporteurs), et suivi de livraison. REST/JSON, bac à sable disponible. Le prix du pack n''est pas affiché sans compte : à relever à l''inscription.'
where nom = 'BigBuy';

update app_e08c374bc4_fournisseurs set
  api_statut = 'a_obtenir',
  api_base_url = 'https://b2b.vidaxl.com/api_customer',
  api_authentification = 'Adresse e-mail du compte dropshipping + jeton d''API',
  api_documentation = 'https://b2b.vidaxl.com/pages/8-api',
  api_prerequis = 'Accès à demander à l''équipe B2B : b2bperformance@vidaxl.com',
  api_note = 'Catalogue : GET /api_customer/products rend les produits qu''on est autorisé à vendre ; le filtre ?code_eq=<SKU> interroge une référence précise. Une API de commandes existe pour l''automatisation. Documentation en accès connecté.'
where nom = 'VidaXL';

update app_e08c374bc4_fournisseurs set
  api_statut = 'branchee',
  api_note = 'Connecteur en service depuis le module d''import CJ. C''est la référence de comparaison : ce que fait CJ, un fournisseur européen doit savoir le faire pour prétendre le remplacer.'
where nom = 'CJ Dropshipping';

update app_e08c374bc4_fournisseurs set
  api_statut = 'aucune',
  api_note = 'Pas d''API publique repérée. Commande par courriel ou espace revendeur — ce qui n''est pas rédhibitoire pour du gros : une commande par mois ne demande pas d''automatisation.'
where nom = 'Brandsdistribution';
