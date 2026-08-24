-- Trois rayons de l'Espace Pro sont retirés, et trois autres gardés.
--
-- CE QUE J'AVAIS DIT, ET QUI ÉTAIT TROP LARGE
--
-- J'avais conclu de six rayons que CJ ne pouvait pas les servir. La conclusion
-- venait d'UNE recherche — « stethoscope » — où dix-huit résultats sur vingt
-- étaient des colliers d'infirmière et des jouets de docteur.
--
-- Avant de supprimer, j'ai regardé ce que chaque rayon contenait vraiment.
-- Trois des six portaient de vrais articles de métier :
--
--     Quincaillerie & BTP     un pulvérisateur airless, ACTIF, 67 968 F d'achat
--     Santé & Matériel        deux stéthoscopes médicaux
--     Agroalimentaire         une porte de poulailler automatique
--
-- Les supprimer aurait détruit de la marchandise réelle pour appliquer une
-- règle que j'avais formulée d'après un seul échantillon. Ils restent.
--
-- CE QUI PART, ET POURQUOI
--
--     Imprimerie & Signalétique              0 enseigne, 0 article
--     Électroménager & Équipement collectif  0 enseigne, 0 article
--     Textile & Uniformes professionnels     1 enseigne vide, 0 article
--
-- Quatre recherches successives chez CJ n'ont rien ramené qui les remplirait
-- honnêtement. Un rayon vide dans une vitrine professionnelle ne se lit pas
-- comme « bientôt » : il se lit comme une maison qui annonce plus qu'elle ne
-- tient, et il abîme la crédibilité des rayons pleins.
--
-- CE QUE QUATRE RECHERCHES ONT ÉTABLI SUR CJ
--
-- CJ cherche mot par mot, jamais par expression : « blood pressure monitor »
-- rend une fleur artificielle « Dragon BLOOD », un manomètre de PRESSION de
-- pneu et un plancher chauffant pour « MONITOR ».
--
-- Et son catalogue est du dropshipping grand public. Sur environ quatre-vingts
-- résultats parcourus, six articles étaient réellement utilisables.
--
-- Les rares articles à forte valeur y arrivent avec des fiches suspectes :
-- libellés en espagnol, et un ventilateur solaire de toiture 42 W / 2800 CFM
-- annoncé à 300 grammes — plusieurs kilos dans la réalité. Ce sont sans doute
-- des revendes de place de marché, pas du stock CJ. Un poids faux fausserait
-- le fret et le groupage : ces articles restent inactifs jusqu'à vérification.

delete from public.app_e08c374bc4_enseignes
where secteur_id in (
  select id from public.app_e08c374bc4_secteurs
  where nom in ('Imprimerie & Signalétique',
                'Électroménager & Équipement collectif',
                'Textile & Uniformes professionnels')
);

delete from public.app_e08c374bc4_secteurs
where nom in ('Imprimerie & Signalétique',
              'Électroménager & Équipement collectif',
              'Textile & Uniformes professionnels');
