import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Scale, MessageSquare, FileText, Image, Lock, ArrowRight } from 'lucide-react';

/**
 * Où l'intelligence artificielle intervient — et où elle n'intervient pas.
 *
 * CE QUE LE FONDATEUR A DEMANDÉ, MOT POUR MOT
 *
 * « Dire où l'IA intervient et dire l'IA utilisée, pas le modèle mais l'IA
 * utilisée. » On nomme donc Gemini ou Claude, jamais « gemini-3.6-flash ».
 * D'abord parce que la version ne dit rien à un client ; ensuite parce qu'une
 * version change tous les trimestres et qu'une page qui l'afficherait serait
 * fausse avant la fin de l'année.
 *
 * LE NOM EST LU, PAS ÉCRIT
 *
 * Le fournisseur de la classification se règle en base. Une page qui
 * l'annoncerait en dur mentirait le jour où le réglage change — sur la section
 * qui promet la transparence, ce serait le pire endroit pour se tromper. Elle
 * interroge donc `ia_en_service`, qui ne laisse sortir que l'étiquette.
 *
 * LA MOITIÉ QUI COMPTE VRAIMENT
 *
 * La deuxième colonne — ce que l'IA ne touche pas — n'est pas une précaution
 * juridique. C'est l'argument commercial. N'importe qui peut brancher un
 * modèle sur un chiffrage douanier et sortir un nombre convaincant. Ce qui
 * distingue MayLary, c'est que les droits et taxes sortent du Tarif Extérieur
 * Commun et d'un moteur en base, jamais d'une IA — et qu'un code absent du
 * tarif fait REFUSER le calcul au lieu d'inventer un taux.
 */

/** Le nom que le public connaît. Jamais la version. */
const NOM_IA: Record<string, { nom: string; maison: string }> = {
  google: { nom: 'Gemini', maison: 'Google' },
  anthropic: { nom: 'Claude', maison: 'Anthropic' },
};

interface IaEnService {
  classification: string;
  classification_active: boolean;
  assistant: string;
  visuels: string;
}

const nommer = (cle: string | undefined) => {
  const ia = cle ? NOM_IA[cle] : undefined;
  /* Un fournisseur qu'on ne sait pas nommer ne s'invente pas : on le tait
   * plutôt que d'écrire un nom au hasard sur la page qui promet la clarté. */
  if (!ia) return null;
  // « de Anthropic » se lit mal : l'élision se fait devant une voyelle.
  const elide = /^[aeiouyàâéèêëîïôöûü]/i.test(ia.maison);
  return `${ia.nom}, ${elide ? 'd’' : 'de '}${ia.maison}`;
};

export default function SystemeIntelligent() {
  const [ia, setIa] = useState<IaEnService | null>(null);

  useEffect(() => {
    supabase.rpc('app_e08c374bc4_ia_en_service').then(({ data }) => {
      if (data) setIa(data as IaEnService);
    });
  }, []);

  const iaClassement = nommer(ia?.classification);
  const iaAssistant = nommer(ia?.assistant);
  const iaVisuels = nommer(ia?.visuels);

  const interventions = [
    {
      icone: Scale,
      titre: 'Proposer une position tarifaire',
      texte:
        'Vous décrivez la marchandise, l’IA propose un code du système harmonisé et le raisonnement qui y mène — matière, fonction, usage, règles générales d’interprétation.',
      ia: iaClassement,
      garde:
        'Le code proposé est ensuite confronté au Tarif Extérieur Commun. S’il n’y figure pas, aucun taux n’est retenu et l’écran le dit.',
    },
    {
      icone: MessageSquare,
      titre: 'Répondre à vos questions',
      texte:
        'Le Déclarant connaît nos services, conseille sur l’incoterm, le mode de transport et le montage d’un dossier, et lit vos commandes pour vous répondre précisément.',
      ia: iaAssistant,
      garde:
        'Dès qu’un chiffre est en jeu, il interroge les moteurs de calcul plutôt que sa mémoire — et il nomme sous chaque réponse les outils qu’il a consultés.',
    },
    {
      icone: FileText,
      titre: 'Rédiger les fiches produit',
      texte:
        'Les descriptions du fournisseur, souvent en anglais et rédigées à la va-vite, sont traduites et remises en forme à l’import.',
      ia: iaClassement,
      garde:
        'Le texte d’origine est conservé à côté. Une fiche réécrite à la main n’est jamais écrasée par un réimport.',
    },
    {
      icone: Image,
      titre: 'Produire les visuels de rayon',
      texte:
        'Les illustrations de catégories et de secteurs de l’Espace Pro sont générées plutôt qu’achetées en banque d’images.',
      ia: iaVisuels,
      garde: 'Aucun visuel n’est publié avant d’avoir été regardé et activé à la main.',
    },
  ];

  const jamais = [
    'Les droits et taxes de douane — calculés par notre moteur sur le Tarif Extérieur Commun officiel, ligne par ligne, assiette par assiette.',
    'Le prix de vente d’un article — une formule : achat, fret réel, assurance au barème de l’assureur, marge.',
    'Le coût du fret — les grilles réelles des transporteurs et les plafonds internationaux.',
    'La position de vos colis — relevée chez le transporteur, ou constatée par nous. Jamais supposée.',
  ];

  return (
    <section className="border-t bg-card">
      <div className="mx-auto max-w-screen-xl px-4 py-16 sm:px-6 sm:py-20">
        <div data-revele className="max-w-3xl">
          <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary-emphasis">
            <Sparkles className="h-3.5 w-3.5" />
            Notre système intelligent
          </Badge>
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            L’intelligence artificielle vous fait gagner du temps.
            <span className="mt-1 block text-muted-foreground">
              Elle ne décide jamais de ce que vous payez.
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Nous ne cachons pas où elle travaille, et nous disons laquelle. Nous disons surtout où
            elle n’a pas le droit d’entrer — c’est ce qui sépare une estimation convaincante d’un
            chiffre défendable devant la douane.
          </p>
        </div>

        {/* ---------- Là où elle travaille ---------- */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {interventions.map((i) => {
            const Icone = i.icone;
            return (
              <div key={i.titre} data-revele className="rounded-lg border bg-background p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icone className="h-4.5 w-4.5 text-primary" />
                  </span>
                  {/* Le nom n'apparaît que lorsqu'on l'a lu. Pas de nom deviné
                      pendant le chargement, pas de nom faux si le réglage
                      change pour un fournisseur qu'on ne sait pas nommer. */}
                  {i.ia && (
                    <Badge variant="secondary" className="shrink-0 text-[11px]">
                      {i.ia}
                    </Badge>
                  )}
                </div>
                <h3 className="mt-3 font-display font-bold text-foreground">{i.titre}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{i.texte}</p>
                <p className="mt-3 border-t pt-3 text-xs leading-relaxed text-foreground">
                  <strong className="font-semibold">Le garde-fou —</strong> {i.garde}
                </p>
              </div>
            );
          })}
        </div>

        {/* ---------- Là où elle n'entre pas ---------- */}
        <div
          data-revele
          className="mt-4 rounded-lg border border-primary/30 bg-primary/[0.04] p-5 sm:p-6"
        >
          <p className="flex items-center gap-2 font-display font-bold text-foreground">
            <Lock className="h-4 w-4 text-primary" />
            Ce que l’IA ne touche pas, et ne touchera pas
          </p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {jamais.map((j) => (
              <li key={j} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {j}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-foreground">
            Un taux de douane inventé engage votre trésorerie et votre responsabilité. Nous
            préférons vous dire « ce code n’est pas au tarif, il faut le vérifier » plutôt que vous
            donner un nombre qui a l’air juste.
          </p>
          <Link
            to="/declarant"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-emphasis hover:underline"
          >
            Voir Le Déclarant en détail
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
