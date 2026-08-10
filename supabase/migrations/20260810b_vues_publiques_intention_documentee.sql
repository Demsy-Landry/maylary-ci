-- Le linter Supabase classe ces sept vues « CRITIQUE ». Elles sont voulues, et
-- les convertir serait moins sûr. La raison est attachée à l'objet lui-même :
-- une note dans un fichier se perd, un commentaire de vue se lit là où
-- l'avertissement apparaît.
--
-- Mesuré sous le rôle `anon` le 10 août 2026 : lecture directe de `produits`
-- → 0 ligne ; via `produits_public` → 50 produits. Neuf colonnes sensibles
-- (prix d'achat, coût de fret, coût d'assurance, incoterm d'achat, identité du
-- fournisseur) ne sortent par aucune de ces vues. Passer la vue en droits de
-- l'appelant obligerait à ouvrir la table au visiteur — donc à exposer ces
-- neuf colonnes. La vue est la protection, pas la faille.

comment on view app_e08c374bc4_produits_public is
  'Porte publique du catalogue. SECURITY DEFINER volontaire : la table `produits` est fermée au visiteur, et cette vue en projette les seules colonnes vendables. Ne pas convertir en security_invoker — cela exigerait d''ouvrir la table, donc d''exposer prix d''achat, coût de fret et fournisseur.';

comment on view app_e08c374bc4_vendeurs_public is
  'Vitrine des vendeurs validés. SECURITY DEFINER volontaire : la table `vendeurs` n''est lisible que par son propriétaire et l''administration.';

comment on view app_e08c374bc4_paliers_prix_public is
  'Paliers de gros des produits actifs. SECURITY DEFINER volontaire : la table `paliers_prix` est réservée à l''administration.';

comment on view app_e08c374bc4_campagnes_groupage_public is
  'Campagnes de groupage ouvertes. SECURITY DEFINER volontaire : la table `campagnes_groupage` est réservée à l''administration.';

comment on view app_e08c374bc4_avis_public is
  'Avis publiés, auteur abrégé. SECURITY DEFINER volontaire : le nom complet de l''auteur vit dans `profiles`, qui reste fermée.';

comment on view app_e08c374bc4_achats_groupes_publics is
  'Campagnes d''achat groupé et leur avancement. SECURITY DEFINER volontaire : l''agrégat compte les participations sans jamais montrer qui participe.';

comment on view app_e08c374bc4_reversements_dus is
  'Sommes dues à chaque vendeur. SECURITY DEFINER volontaire, avec security_barrier : la vue filtre elle-même sur is_admin() / mon_vendeur_id(), et n''est pas lisible par un visiteur non connecté.';
