import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { servirAvecCors } from '../_partage/cors.ts';
import {
  clesAttendues,
  confronterAuCorpus,
  proposer,
  secret,
  type Parametres,
} from '../_partage/classification.ts';

/*
 * Classification tarifaire assistée — la porte du Déclarant.
 *
 * Le moteur lui-même a déménagé dans `_partage/classification.ts` le jour où
 * une deuxième application s'en est servie : la cotation E-Transit. Deux copies
 * de la consigne auraient fini par diverger, et la même marchandise décrite
 * pareil aurait rendu deux codes différents selon la porte d'entrée. Il ne
 * reste donc ici que ce qui est propre à cette porte : qui a le droit
 * d'entrer, combien de fois par jour, et sous quel nom la recherche est
 * inscrite.
 *
 * Ce qui ne change pas : le modèle propose, le corpus tranche. Le taux ne peut
 * venir que de la confrontation au TEC officiel, jamais du modèle. Un modèle
 * qui invente un code inventerait aussi son taux, et un taux inventé coûte un
 * redressement au client.
 *
 * Aucune erreur interne ne ressort d'ici. Un message d'erreur peut contenir la
 * valeur qui l'a provoquée — une clé mal collée, par exemple — et se retrouver
 * dans un journal ou une réponse HTTP.
 */

// Les en-têtes d'autorisation sont posés par `servirAvecCors`, qui
// connaît l'origine de la demande. Ce qui reste ici est écrasé en sortie.
const CORS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

servirAvecCors(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // La clé anonyme est un JWT valide : elle ne prouve pas qu'un compte est
    // derrière la demande. On lit l'identité réelle de l'appelant.
    const autorisation = req.headers.get('Authorization') ?? '';
    const { data: auth } = await supabase.auth.getUser(autorisation.replace('Bearer ', ''));
    const utilisateur = auth?.user;
    if (!utilisateur || utilisateur.role !== 'authenticated') {
      return json(
        { erreur: 'Connectez-vous pour utiliser la classification assistée.', connexion_requise: true },
        401,
      );
    }

    let description = '';
    try {
      description = String(((await req.json()) as { description?: string }).description ?? '').trim();
    } catch {
      return json({ erreur: 'Requête illisible.' }, 400);
    }
    if (description.length < 3 || description.length > 2000) {
      return json({ erreur: 'Décrivez la marchandise en 3 à 2 000 caractères.' }, 400);
    }

    const { data: parametres } = await supabase
      .from('app_e08c374bc4_parametres_classification')
      .select('*')
      .limit(1)
      .single<Parametres>();

    if (!parametres?.actif) {
      return json({ erreur: 'La classification assistée est momentanément désactivée.' }, 503);
    }

    const attendues = clesAttendues(parametres.fournisseur ?? 'google');
    if (!attendues.some((nom) => secret(nom).length > 0)) {
      return json(
        {
          erreur: "La clé de classification n'est pas configurée. Contactez Maylary.",
          cles_attendues: attendues,
        },
        503,
      );
    }

    // Chaque appel coûte de l'argent et la page est publique : le plafond
    // journalier est ce qui empêche un robot de vider le compte.
    const debutJour = new Date();
    debutJour.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('app_e08c374bc4_classifications_hs')
      .select('id', { count: 'exact', head: true })
      .eq('utilisateur_id', utilisateur.id)
      .gte('cree_le', debutJour.toISOString());

    if ((count ?? 0) >= parametres.classifications_par_jour) {
      return json(
        {
          erreur: `Vous avez atteint ${parametres.classifications_par_jour} classifications aujourd'hui. Réessayez demain, ou écrivez-nous pour un accès professionnel.`,
          quota_atteint: true,
        },
        429,
      );
    }

    // --- Le modèle propose ---
    const issue = await proposer(parametres, description);
    if (!issue.ok) return json(issue.corps, issue.statut);

    // --- Le corpus confirme, ou refuse ---
    const resultat = await confronterAuCorpus(supabase, description, issue);

    // L'écriture passe par la clé de service : une classification ne doit pas
    // pouvoir être fabriquée depuis le navigateur, sinon l'historique ne prouve
    // plus rien.
    const { data: enregistre, error: erreurEcriture } = await supabase
      .from('app_e08c374bc4_classifications_hs')
      .insert({
        utilisateur_id: utilisateur.id,
        description,
        code_propose: resultat.code_propose,
        section: resultat.section,
        chapitre: resultat.chapitre,
        position_sh: resultat.position_sh,
        sous_position: resultat.sous_position,
        caracteristiques: resultat.caracteristiques,
        raisonnement_rgi: resultat.raisonnement_rgi,
        notes_declarant: resultat.notes_declarant,
        fournisseur: resultat.fournisseur,
        modele: resultat.modele,
        verifie_en_base: resultat.verifie_en_base,
        designation_tec: resultat.designation_tec,
        unite_us: resultat.unite_us,
        taux_dd: resultat.taux_dd,
      })
      .select('id')
      .single();

    if (erreurEcriture) console.error('ecriture historique', erreurEcriture.code);

    return json({
      ...resultat,
      id: enregistre?.id ?? null,
      restant: Math.max(0, parametres.classifications_par_jour - (count ?? 0) - 1),
    });
  } catch (e) {
    // Volontairement sans le message : il peut citer la valeur fautive.
    console.error('incident', (e as Error)?.name);
    return json(
      { erreur: 'Incident pendant la classification. Réessayez, et signalez-le si cela persiste.' },
      500,
    );
  }
});
