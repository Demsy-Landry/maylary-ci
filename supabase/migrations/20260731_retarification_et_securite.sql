-- Retarification du catalogue au coût de revient réel
-- ---------------------------------------------------
-- Marque un produit dont le prix a été recalculé au coût de revient réel.
-- Sert aussi de curseur de reprise à la retarification par lots.
alter table app_e08c374bc4_produits
  add column if not exists retarife_le timestamptz;

comment on column app_e08c374bc4_produits.retarife_le is
  'Date du dernier recalcul du prix par app_e08c374bc4_cj_retarifer. Null = prix hérité d''avant le modèle de coût.';


-- Sécurité : la numérotation des factures n'est pas un point d'entrée public
-- --------------------------------------------------------------------------
-- La numérotation des factures est une séquence légale : elle doit rester
-- continue. Exposée en RPC à `anon`, la fonction permettait à n'importe quel
-- visiteur muni de la clé publique de brûler des numéros en boucle et de trouer
-- la série. Seule l'edge function d'émission (service_role) doit l'appeler.
revoke execute on function public.app_e08c374bc4_prochain_numero_facture(text) from public;
revoke execute on function public.app_e08c374bc4_prochain_numero_facture(text) from anon;
revoke execute on function public.app_e08c374bc4_prochain_numero_facture(text) from authenticated;
grant  execute on function public.app_e08c374bc4_prochain_numero_facture(text) to service_role;

-- Même raisonnement : c'est un trigger sur auth.users, jamais une route REST.
revoke execute on function public.app_e08c374bc4_creer_profil_a_inscription() from public;
revoke execute on function public.app_e08c374bc4_creer_profil_a_inscription() from anon;
revoke execute on function public.app_e08c374bc4_creer_profil_a_inscription() from authenticated;


-- Sécurité : plus d'énumération des fichiers clients
-- --------------------------------------------------
-- Ces politiques SELECT larges permettaient à n'importe quel visiteur
-- d'énumérer tous les dossiers clients et tous les noms de fichiers des buckets
-- de documents et de photos (factures fournisseurs, packing lists...).
-- La lecture d'un objet par URL publique ne dépend pas d'elles.
drop policy if exists import_documents_public_read on storage.objects;
drop policy if exists export_documents_public_read on storage.objects;
drop policy if exists import_photos_public_read    on storage.objects;
drop policy if exists export_photos_public_read    on storage.objects;
drop policy if exists produit_photos_public_read   on storage.objects;
drop policy if exists logos_public_read            on storage.objects;

-- Aucune limite de taille ni de type n'était posée sur les dépôts.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','application/pdf']
 where id in ('app_e08c374bc4_import_photos','app_e08c374bc4_export_photos',
              'app_e08c374bc4_produit_photos','app_e08c374bc4_enseigne_logos');

update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf',
                                  'application/msword',
                                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                  'application/vnd.ms-excel',
                                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
 where id in ('app_e08c374bc4_import_documents','app_e08c374bc4_export_documents');
