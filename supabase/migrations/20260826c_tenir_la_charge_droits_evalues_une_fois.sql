-- TENIR LA CHARGE : ÉVALUER LES DROITS UNE FOIS, PAS À CHAQUE LIGNE.
--
-- CE QUI A ÉTÉ MESURÉ
--
-- Banc d'essai monté pour l'occasion : une table de cinquante mille lignes,
-- portant exactement le motif de politique utilisé partout dans cette base.
-- Lecture par un client connecté :
--
--     avant la correction  ...  117,8 ms
--     après la correction  ...   13,6 ms
--
-- Neuf fois moins. La donnée est la même, le résultat est le même ; seule
-- change la façon dont Postgres vérifie les droits.
--
-- Écrite `auth.uid()`, la fonction est rejouée POUR CHAQUE LIGNE examinée.
-- Écrite `(select auth.uid())`, elle est évaluée une seule fois en tête de
-- requête, et le résultat sert pour toutes les lignes. Le sens de la règle ne
-- change pas d'un iota : le même utilisateur voit les mêmes lignes.
--
-- LE CAS LE PLUS GRAVE ÉTAIT AILLEURS
--
-- `app_e08c374bc4_is_admin()` était déclarée VOLATILE — le défaut de Postgres
-- quand on ne précise rien, et je n'avais rien précisé. Une fonction volatile
-- ne peut JAMAIS être mise en cache : Postgres doit la rejouer à chaque ligne,
-- sans exception. Or cette fonction interroge la table des profils.
--
-- Autrement dit : sur une table de cent mille lignes, cette seule politique
-- déclenchait cent mille requêtes sur les profils. Et quatre-vingt-treize
-- politiques l'appellent.
--
-- La passer en STABLE dit à Postgres une vérité simple : le statut
-- d'administrateur ne change pas au milieu d'une requête. C'est la correction
-- la plus rentable de tout l'audit, et elle tient en un mot.
--
-- POURQUOI CE N'EST PAS UN RISQUE DE SÉCURITÉ
--
-- STABLE ne veut pas dire « mis en cache entre deux requêtes ». La garantie
-- porte sur UNE requête : à l'intérieur d'une même requête, le résultat ne
-- change pas. C'est exactement ce qui est vrai ici. Quelqu'un qui perd ses
-- droits d'administrateur les perd dès la requête suivante.
--
-- Vérifié après application : un visiteur anonyme voit les 175 articles de la
-- vitrine, et zéro commande, zéro profil, zéro paramètre. Comme avant.

alter function app_e08c374bc4_is_admin() stable;

do $$
declare
  p record;
  nouvelle_qual text;
  nouvelle_check text;
  commande text;
  corrigees int := 0;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '')       ~ '(auth\.(uid|role|jwt)\(\)|app_e08c374bc4_is_admin\(\))'
        or coalesce(with_check,'') ~ '(auth\.(uid|role|jwt)\(\)|app_e08c374bc4_is_admin\(\))'
      )
      and coalesce(qual,'') !~ 'SELECT auth\.'
      and coalesce(with_check,'') !~ 'SELECT auth\.'
  loop
    nouvelle_qual := p.qual;
    nouvelle_check := p.with_check;

    foreach commande in array array[
      'auth.uid()', 'auth.role()', 'auth.jwt()', 'app_e08c374bc4_is_admin()'
    ] loop
      nouvelle_qual  := replace(nouvelle_qual,  commande, '(select ' || commande || ')');
      nouvelle_check := replace(nouvelle_check, commande, '(select ' || commande || ')');
    end loop;

    -- ALTER plutôt que DROP puis CREATE : la table n'est jamais, même une
    -- fraction de seconde, sans politique. Une fenêtre sans règle sur une
    -- table de commandes serait une fuite de données.
    if p.qual is not null and p.with_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)',
                     p.policyname, p.schemaname, p.tablename, nouvelle_qual, nouvelle_check);
    elsif p.qual is not null then
      execute format('alter policy %I on %I.%I using (%s)',
                     p.policyname, p.schemaname, p.tablename, nouvelle_qual);
    elsif p.with_check is not null then
      execute format('alter policy %I on %I.%I with check (%s)',
                     p.policyname, p.schemaname, p.tablename, nouvelle_check);
    end if;

    corrigees := corrigees + 1;
  end loop;

  raise notice 'Politiques corrigées : %', corrigees;
end $$;
