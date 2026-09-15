import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  clesAttendues,
  confronterAuCorpus,
  proposer,
  secret,
  type Parametres,
} from '../_partage/classification.ts';

/*
 * Classification tarifaire pour une application sans comptes.
 *
 * La cotation E-Transit vit sur un poste de bureau : pas d'inscription, pas de
 * session. Elle ne peut donc pas présenter un jeton d'utilisateur comme le fait
 * le Déclarant. Mais ouvrir la classification à tout venant reviendrait à
 * laisser n'importe quel robot vider le compte du fournisseur de modèle.
 *
 * D'où la clé de poste : elle porte l'identité d'un compte MayLary, elle porte
 * un plafond quotidien, elle se révoque d'un clic, et chaque classification
 * qu'elle produit entre dans l'historique de ce compte. C'est ce dernier point
 * qui fait la continuité recherchée — un code cherché au Déclarant se retrouve
 * dans E-Transit, et l'inverse.
 *
 * L'origine de la requête n'est pas un contrôle : le fichier hors ligne
 * s'ouvre depuis le disque et n'a pas d'origine. C'est la clé qui garde la
 * porte, elle seule.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/** La clé ne se compare qu'en empreinte : la base n'en détient jamais le clair. */
async function empreinteDe(cle: string): Promise<string> {
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cle));
  return Array.from(new Uint8Array(octets))
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (requete) => {
  if (requete.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let corps: { cle?: string; description?: string; action?: string; limite?: number };
    try {
      corps = await requete.json();
    } catch {
      return json({ erreur: 'Requête illisible.' }, 400);
    }

    const cle = String(corps.cle ?? '').trim();
    if (cle.length < 20) {
      return json({ erreur: 'Clé de poste absente ou trop courte.', cle_invalide: true }, 401);
    }

    const { data: poste } = await supabase
      .from('app_e08c374bc4_cles_poste')
      .select('*')
      .eq('empreinte', await empreinteDe(cle))
      .maybeSingle();

    if (!poste) {
      return json(
        { erreur: "Cette clé de poste n'est pas reconnue. Vérifiez-la dans les réglages.", cle_invalide: true },
        401,
      );
    }
    if (!poste.actif) {
      return json(
        { erreur: 'Cette clé de poste a été désactivée. Demandez-en une nouvelle.', cle_revoquee: true },
        403,
      );
    }

    const debutJour = new Date();
    debutJour.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('app_e08c374bc4_classifications_hs')
      .select('id', { count: 'exact', head: true })
      .eq('utilisateur_id', poste.utilisateur_id)
      .gte('cree_le', debutJour.toISOString());

    /* ------------------------------------------------ simple vérification */
    if (corps.action === 'verifier') {
      return json({
        ok: true,
        libelle: poste.libelle,
        plafond_jour: poste.classifications_par_jour,
        utilisees_aujourdhui: count ?? 0,
      });
    }

    /* ------------------- reprise de ce qui a déjà été cherché au Déclarant */
    if (corps.action === 'historique') {
      const limite = Math.min(Math.max(Number(corps.limite) || 25, 1), 100);
      const { data: lignes } = await supabase
        .from('app_e08c374bc4_classifications_hs')
        .select(
          'id, description, code_propose, chapitre, position_sh, caracteristiques, ' +
            'verifie_en_base, designation_tec, unite_us, taux_dd, cree_le',
        )
        .eq('utilisateur_id', poste.utilisateur_id)
        .order('cree_le', { ascending: false })
        .limit(limite);
      return json({ classifications: lignes ?? [] });
    }

    /* ------------------------------------------------ nouvelle classification */
    const description = String(corps.description ?? '').trim();
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

    // Le plafond le plus bas gagne : une clé de poste peut resserrer la
    // consommation, jamais l'élargir au-delà de ce que le compte autorise.
    const plafond = Math.min(
      poste.classifications_par_jour,
      parametres.classifications_par_jour ?? poste.classifications_par_jour,
    );
    if ((count ?? 0) >= plafond) {
      return json(
        {
          erreur: `Ce poste a atteint ${plafond} classifications aujourd'hui. Réessayez demain.`,
          quota_atteint: true,
        },
        429,
      );
    }

    const attendues = clesAttendues(parametres.fournisseur ?? 'google');
    if (!attendues.some((nom) => secret(nom).length > 0)) {
      return json(
        { erreur: "La clé de classification n'est pas configurée côté serveur.", cles_attendues: attendues },
        503,
      );
    }

    const issue = await proposer(parametres, description);
    if (!issue.ok) return json(issue.corps, issue.statut);

    const resultat = await confronterAuCorpus(supabase, description, issue);

    // L'historique est celui du compte porteur de la clé : c'est lui qui donne
    // la continuité entre le Déclarant et la cotation.
    const { data: enregistre } = await supabase
      .from('app_e08c374bc4_classifications_hs')
      .insert({
        utilisateur_id: poste.utilisateur_id,
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

    await supabase
      .from('app_e08c374bc4_cles_poste')
      .update({ dernier_usage_le: new Date().toISOString(), usages: (poste.usages ?? 0) + 1 })
      .eq('id', poste.id);

    return json({
      ...resultat,
      id: enregistre?.id ?? null,
      restant: Math.max(0, plafond - (count ?? 0) - 1),
    });
  } catch (e) {
    // Volontairement sans le message : il peut citer la valeur fautive.
    console.error('incident', (e as Error)?.name);
    return json({ erreur: 'Incident pendant la classification. Réessayez.' }, 500);
  }
});
