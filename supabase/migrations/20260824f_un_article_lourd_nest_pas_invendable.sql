-- Un article que CJ ne cote pas n'est pas un article invendable.
--
-- CE QUE LA TARIFICATION A RÉVÉLÉ
--
-- Passage complet sur les 77 articles sans grille de gros. Verdict :
--
--     fret_non_cote                 64 articles   achat moyen  57 467 F
--     publiés                       64 articles   achat moyen  12 666 F
--     fret_disproportionné           5 articles   fret 17 727 F pour 2 300 F d'achat
--     commande minimum trop élevée   3 articles
--
-- Plus de la moitié du catalogue s'était éteinte. En regardant de près, les 57
-- refusés en mode groupage pèsent ONZE KILOS ET DEMI en moyenne : fauteuils
-- ergonomiques, meubles TV, armoires, vanités de salle de bain, réfrigérateur
-- de voiture, coffre à outils.
--
-- CJ ne les cote pas parce qu'ils sont LOURDS. Pas parce qu'ils sont mauvais.
--
-- LE FILTRE AVAIT RAISON HIER, ET TORT AUJOURD'HUI
--
-- Il a été écrit quand tout partait par CJ express : si le transporteur ne
-- cotait pas, la marchandise ne pouvait pas être livrée, donc l'article
-- s'éteignait. C'était exact à l'époque.
--
-- Depuis, le mode `groupage` existe — et un article lourd est précisément celui
-- qui doit voyager par conteneur partagé, au barème que nous maîtrisons. Les
-- éteindre revenait à refuser de vendre ce qui rapporte le plus, pour la raison
-- même qui le rend rentable en maritime.
--
-- CE QU'ON RALLUME, ET CE QU'ON LAISSE ÉTEINT
--
-- Rallumés : les 36 articles de groupage qui ONT déjà un prix — de 46 000 à
-- 325 000 francs.
--
-- Laissés éteints : ceux à zéro franc. Un article sans prix n'est pas prêt à
-- paraître, quoi qu'il vaille. Ils attendent le moteur de marge de chaîne, qui
-- chiffrera leur fret de groupage au barème du fondateur plutôt que chez CJ.

update public.app_e08c374bc4_produits
set actif = true,
    indisponible_motif = null
where indisponible_motif = 'fret_non_cote'
  and mode_acheminement = 'groupage'
  and prix_unitaire_fcfa > 0;
