-- Retrait de la vitrine des produits dont le prix n'est pas tenable
-- -----------------------------------------------------------------
alter table app_e08c374bc4_produits
  add column if not exists indisponible_motif text;
comment on column app_e08c374bc4_produits.indisponible_motif is
  'Raison du retrait de la vitrine. Null = produit publiable.';

-- Buckets clients en privé
-- ------------------------
-- Documents et photos déposés par les clients sont des pièces commerciales.
-- Les buckets étaient publics : toute personne connaissant l'URL pouvait les
-- lire, sans compte. Accès désormais par URL signée à durée limitée.
update storage.buckets set public = false
 where id in ('app_e08c374bc4_import_documents','app_e08c374bc4_export_documents',
              'app_e08c374bc4_import_photos','app_e08c374bc4_export_photos');

-- Deux conventions de nommage coexistent :
--   dépôt client : `<user_id>/<uuid>-<fichier>`
--   dépôt admin  : `<id de la demande>/<uuid>-<fichier>`
-- Le client doit lire les deux : ses pièces, et celles versées à son dossier.
create policy app_e08c374bc4_import_documents_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'app_e08c374bc4_import_documents'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or app_e08c374bc4_is_admin()
              or exists (select 1 from app_e08c374bc4_demandes_import d
                          where d.id::text = (storage.foldername(name))[1]
                            and d.user_id = auth.uid())));

create policy app_e08c374bc4_import_photos_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'app_e08c374bc4_import_photos'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or app_e08c374bc4_is_admin()
              or exists (select 1 from app_e08c374bc4_demandes_import d
                          where d.id::text = (storage.foldername(name))[1]
                            and d.user_id = auth.uid())));

create policy app_e08c374bc4_export_documents_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'app_e08c374bc4_export_documents'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or app_e08c374bc4_is_admin()
              or exists (select 1 from app_e08c374bc4_demandes_export d
                          where d.id::text = (storage.foldername(name))[1]
                            and d.user_id = auth.uid())));

create policy app_e08c374bc4_export_photos_lecture on storage.objects
  for select to authenticated
  using (bucket_id = 'app_e08c374bc4_export_photos'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or app_e08c374bc4_is_admin()
              or exists (select 1 from app_e08c374bc4_demandes_export d
                          where d.id::text = (storage.foldername(name))[1]
                            and d.user_id = auth.uid())));

-- Chemin de résolution figé
-- -------------------------
-- Sans search_path figé, une fonction résout ses noms de tables selon le chemin
-- de l'appelant, ce qui ouvre un détournement d'appel.
alter function public.app_e08c374bc4_set_demande_ref()      set search_path = public;
alter function public.app_e08c374bc4_set_import_ref()       set search_path = public;
alter function public.app_e08c374bc4_set_export_ref()       set search_path = public;
alter function public.app_e08c374bc4_gen_ref_commande_gp()  set search_path = public;
alter function public.app_e08c374bc4_touch_updated_at()     set search_path = public;
alter function public.app_e08c374bc4_set_updated_at()       set search_path = public;
