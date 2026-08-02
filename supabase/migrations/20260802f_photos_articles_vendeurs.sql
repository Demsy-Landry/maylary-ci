-- Un vendeur dépose les photos de ses articles.
--
-- Le dépôt est public en lecture — une photo d'article doit s'afficher sans
-- authentification — mais l'écriture était réservée à l'administration. Un
-- vendeur publiait donc des articles sans image, donc invendables.
--
-- Chaque vendeur n'écrit que dans son propre dossier : `vendeurs/<son id>/…`.
-- Le chemin porte la clé d'accès, ce qui rend impossible d'écraser la photo
-- d'un concurrent.
drop policy if exists produit_photos_vendeur_insert on storage.objects;
create policy produit_photos_vendeur_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'app_e08c374bc4_produit_photos'
    and app_e08c374bc4_mon_vendeur_id() is not null
    and name like 'vendeurs/' || app_e08c374bc4_mon_vendeur_id()::text || '/%'
  );

drop policy if exists produit_photos_vendeur_delete on storage.objects;
create policy produit_photos_vendeur_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'app_e08c374bc4_produit_photos'
    and app_e08c374bc4_mon_vendeur_id() is not null
    and name like 'vendeurs/' || app_e08c374bc4_mon_vendeur_id()::text || '/%'
  );
