-- Les marchandises qu'on ne dédouane pas sans autorisation préalable.
--
-- Le fondateur a posé la règle : « il y a des articles vraiment compliqués à
-- importer et exporter, il faut qu'on fasse la nuance AVANT que quelqu'un
-- importe ce genre de marchandise ». C'est le bon ordre. Un client qui découvre
-- au port qu'il lui fallait un enregistrement AIRP a déjà payé le fret, le
-- fournisseur et l'acconage — et sa marchandise reste bloquée.
--
-- Deux choses que cette table doit dire, et que l'application ne disait pas :
--
-- **Qui a le droit de demander.** L'enregistrement des laits infantiles n'est
-- pas ouvert à n'importe quel importateur : il faut être une industrie
-- laitière, une industrie agro-alimentaire, un établissement légalement
-- constitué, ou une agence de représentation de produits parapharmaceutiques.
-- Un particulier qui veut importer du lait infantile n'a pas un dossier
-- difficile — il n'a pas de dossier du tout.
--
-- **Ce qu'on conseille à quelqu'un qui démarre.** Le fondateur l'a dit :
-- « des entreprises préfèrent, dans les débuts, éviter ce genre de
-- marchandise ». Le conseil vaut mieux que le silence, et il vaut mieux que
-- l'enthousiasme.
--
-- Source : fiches « Modalités d'enregistrement » de l'AIRP transmises par le
-- fondateur, et Circulaire DGD n° 848 du 13 mai 1997 pour l'assurance.

create table if not exists app_e08c374bc4_marchandises_reglementees (
  code                          text primary key,
  libelle                       text not null,
  famille                       text not null,
  sens                          text not null default 'import'
                                check (sens in ('import', 'export', 'les_deux')),
  autorite                      text not null,
  autorite_sigle                text,
  base_legale                   text not null,
  document_requis               text not null,
  -- Ce qui bloque le plus souvent : le demandeur n'a pas la qualité requise.
  personnes_morales_autorisees  text[] not null default '{}',
  pieces_du_dossier             text[] not null default '{}',
  exemplaires                   integer,
  adresse_depot                 text,
  contact                       text,
  site_web                      text,
  -- 1 : formalité. 2 : dossier exigeant. 3 : à éviter quand on démarre.
  difficulte                    integer not null default 2 check (difficulte between 1 and 3),
  conseil_demarrage             text,
  -- Sur quoi la détection s'appuie. Sans accents : la saisie d'un client n'en
  -- porte pas toujours.
  mots_cles                     text[] not null default '{}',
  positions_sh                  text[] not null default '{}',
  actif                         boolean not null default true,
  note                          text
);

alter table app_e08c374bc4_marchandises_reglementees enable row level security;
drop policy if exists "Marchandises réglementées lisibles" on app_e08c374bc4_marchandises_reglementees;
create policy "Marchandises réglementées lisibles"
  on app_e08c374bc4_marchandises_reglementees for select using (true);
drop policy if exists "Marchandises réglementées admin" on app_e08c374bc4_marchandises_reglementees;
create policy "Marchandises réglementées admin"
  on app_e08c374bc4_marchandises_reglementees for all
  using (app_e08c374bc4_is_admin()) with check (app_e08c374bc4_is_admin());

/** Une désignation comparable : minuscules, sans accents. */
create or replace function app_e08c374bc4_sans_accent(p text)
returns text language sql immutable
set search_path = public
as $$
  select translate(lower(coalesce(p, '')),
                   'àâäãéèêëíìîïóòôöõúùûüçñ',
                   'aaaaeeeeiiiiooooouuuucn')
$$;

/**
 * Cette marchandise demande-t-elle une autorisation préalable ?
 *
 * La question se pose AVANT le devis, pas au port.
 *
 * **Ce que cette fonction ne dira jamais : « aucune restriction ».** Le
 * registre est ce que le fondateur y a mis, pas le droit ivoirien tout entier.
 * Répondre « rien à signaler » sur une marchandise absente du registre serait
 * une autorisation implicite que nous n'avons pas qualité à donner — et la
 * seule erreur de cette fonction qui puisse coûter une saisie.
 */
create or replace function app_e08c374bc4_marchandise_reglementee(
  p_designation text,
  p_code_sh     text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_texte   text := app_e08c374bc4_sans_accent(p_designation);
  v_code    text := regexp_replace(coalesce(p_code_sh, ''), '[^0-9]', '', 'g');
  v_fiches  jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(m) order by m.difficulte desc, m.libelle), '[]'::jsonb)
  into v_fiches
  from app_e08c374bc4_marchandises_reglementees m
  where m.actif
    and (
      (v_texte <> '' and exists (
        select 1 from unnest(m.mots_cles) mc
        where v_texte like '%' || app_e08c374bc4_sans_accent(mc) || '%'))
      or (v_code <> '' and exists (
        select 1 from unnest(m.positions_sh) ps
        where v_code like regexp_replace(ps, '[^0-9]', '', 'g') || '%'))
    );

  return jsonb_build_object(
    'trouve', jsonb_array_length(v_fiches) > 0,
    'fiches', v_fiches,
    'avertissement', case
      when jsonb_array_length(v_fiches) > 0 then
        'Cette marchandise relève d''une procédure particulière. L''autorisation doit être obtenue AVANT l''expédition : sans elle, la marchandise reste bloquée à l''arrivée et les frais de séjour courent.'
      else
        'Aucune fiche ne correspond dans notre registre. Ce registre n''est pas exhaustif : l''absence de fiche ne vaut pas autorisation d''importer. En cas de doute sur une marchandise sensible — santé, alimentaire, chimie, armes, télécommunications —, faites vérifier avant de commander.'
    end);
end;
$$;

revoke all on function app_e08c374bc4_sans_accent(text) from public, anon, authenticated;
grant execute on function app_e08c374bc4_sans_accent(text) to service_role;
revoke all on function app_e08c374bc4_marchandise_reglementee(text, text)
  from public, anon, authenticated;
grant execute on function app_e08c374bc4_marchandise_reglementee(text, text)
  to anon, authenticated, service_role;
