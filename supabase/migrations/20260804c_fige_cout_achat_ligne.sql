-- Le coût d'achat est figé côté serveur, à l'insertion de la ligne de commande.
--
-- Il ne peut pas venir du navigateur : `prix_achat_fcfa` est délibérément
-- absent de la vue publique des produits, et le faire transiter par le client
-- exposerait nos prix fournisseur à quiconque ouvre les outils de développement.
-- C'est la première approche que j'avais prise, et elle était fausse.
--
-- Il ne peut pas non plus être relu au moment de comptabiliser : la fiche
-- produit est retarifée quand le fournisseur bouge ses prix, et la marge d'une
-- commande de mars serait alors calculée sur les coûts d'août.
create or replace function app_e08c374bc4_figer_cout_ligne()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.produit_id is null then
    return new;
  end if;

  -- Une valeur déjà fournie est respectée : une reprise administrative doit
  -- pouvoir corriger un coût sans que le déclencheur l'écrase.
  select
    coalesce(new.cout_achat_fcfa, p.prix_achat_fcfa),
    coalesce(new.cout_fret_fcfa, p.cout_fret_fcfa),
    coalesce(new.cout_assurance_fcfa, p.cout_assurance_fcfa)
  into new.cout_achat_fcfa, new.cout_fret_fcfa, new.cout_assurance_fcfa
  from app_e08c374bc4_produits p
  where p.id = new.produit_id;

  return new;
end;
$$;

drop trigger if exists app_e08c374bc4_figer_cout_ligne on app_e08c374bc4_lignes_commande_gp;
create trigger app_e08c374bc4_figer_cout_ligne
  before insert on app_e08c374bc4_lignes_commande_gp
  for each row execute function app_e08c374bc4_figer_cout_ligne();

revoke execute on function app_e08c374bc4_figer_cout_ligne() from public, anon, authenticated;
