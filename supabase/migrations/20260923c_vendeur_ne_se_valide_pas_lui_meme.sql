-- Faille corrigée : un vendeur pouvait s'auto-valider.
--
-- Les politiques d'écriture de `vendeurs` laissaient un utilisateur créer sa
-- fiche vendeur, ou la modifier, en fixant `statut = 'valide'` lui-même. Or un
-- vendeur validé apparaît publiquement (vue `vendeurs_public`) et ses produits
-- s'affichent en boutique (vue `produits_public`). N'importe qui pouvait donc se
-- présenter comme vendeur MayLary agréé et publier, sans passer par ta
-- validation.
--
-- On ferme la porte au bon endroit : un garde qui neutralise le `statut` quand
-- l'écriture ne vient pas de l'administration. À la création, le vendeur naît
-- toujours « en_attente » ; à la modification, il ne peut pas changer son propre
-- statut. Seuls l'administration — ou le serveur (clé de service) — valident,
-- suspendent ou refusent. Le vendeur reste libre de corriger son nom, son logo,
-- sa description : le garde ne touche qu'au statut.

create or replace function public.app_e08c374bc4_vendeur_statut_garde()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Le serveur (auth.uid() absent) et l'administration décident du statut.
  if auth.uid() is null or app_e08c374bc4_is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.statut := 'en_attente';   -- un vendeur ne naît jamais validé
  elsif tg_op = 'UPDATE' then
    new.statut := old.statut;     -- un vendeur ne change pas son propre statut
  end if;
  return new;
end;
$$;

drop trigger if exists app_e08c374bc4_vendeurs_statut_garde on public.app_e08c374bc4_vendeurs;
create trigger app_e08c374bc4_vendeurs_statut_garde
  before insert or update on public.app_e08c374bc4_vendeurs
  for each row execute function public.app_e08c374bc4_vendeur_statut_garde();
