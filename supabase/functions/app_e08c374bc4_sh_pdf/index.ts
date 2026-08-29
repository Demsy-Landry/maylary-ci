/**
 * Lire le texte d'un PDF du Tarif Extérieur Commun publié par l'UEMOA.
 *
 * POURQUOI CETTE FONCTION EXISTE
 *
 * Les Notes légales de Section et de Chapitre fondent chaque classement
 * tarifaire. L'UEMOA en publie une partie en pages web — nous les avons
 * chargées — mais les Sections IX à XXI ne sont publiées qu'en PDF. Ce sont
 * justement celles qui portent les chapitres de notre catalogue : 61
 * (vêtements), 64 (chaussures), 71 (bijouterie), 85 (électrique), 94
 * (meubles), 96 (articles divers).
 *
 * La base ne sait pas lire un PDF. `pg_net` traite la réponse comme du texte
 * et jette les octets qui n'en sont pas : sur la Section 11, il ne ramenait
 * que 1 419 octets d'un document qui en pèse des millions. Et les flux d'un
 * PDF sont compressés, donc illisibles sans être décodés.
 *
 * Deno, lui, sait manipuler des octets. Cette fonction fait le pont : la base
 * l'appelle, elle récupère le PDF, en extrait le texte, et le renvoie.
 *
 * ELLE N'EST PAS UN RELAIS OUVERT
 *
 * Une fonction publique qui va chercher l'adresse qu'on lui donne est une
 * porte d'entrée : on lui ferait interroger des adresses internes qui ne sont
 * pas censées être joignables de l'extérieur. C'est pour cela que l'adresse
 * demandée doit commencer EXACTEMENT par le dossier public des documents de
 * l'UEMOA. Tout le reste est refusé, sans exception et sans réglage.
 */

import { servirAvecCors } from '../_partage/cors.ts';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';

/**
 * Le seul endroit d'où cette fonction accepte de lire.
 *
 * Le contrôle porte sur le début de l'adresse APRÈS analyse, jamais sur le
 * texte brut : `https://e-docucenter.uemoa.int@ailleurs.example/` commence
 * bien par la bonne chaîne de caractères, mais ne désigne pas ce serveur.
 */
const HOTE_AUTORISE = 'e-docucenter.uemoa.int';
const DOSSIER_AUTORISE = '/sites/default/files/';

function adresseAcceptable(brut: string): URL | null {
  let adresse: URL;
  try {
    adresse = new URL(brut);
  } catch {
    return null;
  }
  if (adresse.protocol !== 'https:') return null;
  if (adresse.hostname !== HOTE_AUTORISE) return null;
  if (!adresse.pathname.startsWith(DOSSIER_AUTORISE)) return null;
  if (!adresse.pathname.toLowerCase().endsWith('.pdf')) return null;
  return adresse;
}

function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

servirAvecCors(async (req) => {
  if (req.method !== 'POST') {
    return json({ erreur: 'Utiliser POST.' }, 405);
  }

  let demande: { url?: unknown; de?: unknown; a?: unknown };
  try {
    demande = await req.json();
  } catch {
    return json({ erreur: 'Corps JSON illisible.' }, 400);
  }

  if (typeof demande.url !== 'string') {
    return json({ erreur: 'Le champ « url » est obligatoire.' }, 400);
  }

  const adresse = adresseAcceptable(demande.url);
  if (!adresse) {
    return json(
      {
        erreur:
          `Adresse refusée. Cette fonction ne lit que les PDF publiés sous ` +
          `https://${HOTE_AUTORISE}${DOSSIER_AUTORISE}`,
      },
      403,
    );
  }

  const reponse = await fetch(adresse.toString());
  if (!reponse.ok) {
    return json({ erreur: `L'UEMOA a répondu ${reponse.status}.` }, 502);
  }

  const octets = new Uint8Array(await reponse.arrayBuffer());
  const document = await getDocumentProxy(octets);

  // `mergePages: false` garde une entrée par page : c'est ce qui permet de
  // redemander une tranche quand un document est trop gros pour une réponse.
  const { totalPages, text } = await extractText(document, { mergePages: false });
  const pages = text as string[];

  // Sans bornes, on renvoie tout. Les bornes se comptent à partir de 1, comme
  // les pages d'un document imprimé.
  const de = typeof demande.de === 'number' ? Math.max(1, Math.trunc(demande.de)) : 1;
  const a = typeof demande.a === 'number' ? Math.min(totalPages, Math.trunc(demande.a)) : totalPages;
  if (de > a) return json({ erreur: 'Tranche de pages vide.' }, 400);

  const tranche = pages.slice(de - 1, a);

  return json({
    url: adresse.toString(),
    pages_totales: totalPages,
    de,
    a,
    octets: octets.length,
    texte: tranche.join('\n'),
  });
});
