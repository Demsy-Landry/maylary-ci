// Tarif extérieur commun, servi en lecture publique.
//
// Le TEC est un texte réglementaire : il n'y a rien à protéger dedans. Cette
// fonction existe pour qu'une application tierce — la cotation E-Transit posée
// sur le poste de madame Estelle — puisse récupérer les 6 298 positions une
// seule fois, les ranger dans sa propre base locale, et ne plus jamais dépendre
// du réseau ensuite.
//
// Aucune clé n'est demandée : une clé déposée dans un fichier installé sur un
// poste de bureau n'est plus une clé.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const entetesCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface LigneTec {
  code_hs: string;
  designation: string;
  unite_us: string | null;
  taux_dd: number | string | null;
  categorie: number | null;
}

Deno.serve(async (requete) => {
  if (requete.method === 'OPTIONS') {
    return new Response(null, { headers: entetesCors });
  }

  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // PostgREST plafonne les réponses : on pagine jusqu'à épuisement plutôt que
  // de livrer un tarif tronqué sans le dire.
  const lignes: Array<[string, number | null, string, string, number | null]> = [];
  const parPage = 1000;
  for (let depart = 0; ; depart += parPage) {
    const { data, error } = await client
      .from('app_e08c374bc4_tec_dd_reference')
      .select('code_hs, designation, unite_us, taux_dd, categorie')
      .order('code_hs')
      .range(depart, depart + parPage - 1);

    if (error) {
      return new Response(JSON.stringify({ erreur: error.message }), {
        status: 500,
        headers: { ...entetesCors, 'Content-Type': 'application/json' },
      });
    }

    const page = (data ?? []) as LigneTec[];
    for (const l of page) {
      const taux = l.taux_dd === null ? null : Number(l.taux_dd);
      lignes.push([
        l.code_hs,
        taux !== null && Number.isFinite(taux) ? taux : null,
        l.unite_us ?? '',
        l.designation ?? '',
        l.categorie ?? null,
      ]);
    }
    if (page.length < parPage) break;
  }

  const { data: version } = await client
    .from('app_e08c374bc4_parametres_tarif')
    .select('*')
    .limit(1)
    .maybeSingle();

  const charge = {
    source: 'Tarif extérieur commun CEDEAO — Côte d’Ivoire',
    version: version ?? null,
    genere_le: new Date().toISOString(),
    colonnes: ['code_hs', 'taux_dd', 'unite', 'designation', 'categorie'],
    nombre: lignes.length,
    lignes,
  };

  return new Response(JSON.stringify(charge), {
    headers: {
      ...entetesCors,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
