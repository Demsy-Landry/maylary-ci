import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase, EDGE_FUNCTIONS_URL } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, X, Send, Loader2, Sparkles } from 'lucide-react';

/**
 * Le Déclarant, présent sur toutes les pages.
 *
 * Ce n'est pas un widget de support : c'est le logisticien de la maison. Il
 * connaît les services de MayLary Group, il conseille sur l'incoterm, le mode, le
 * montage du dossier — et dès qu'un chiffre est en jeu, il interroge les
 * moteurs plutôt que sa mémoire.
 *
 * D'où le bandeau sous chaque réponse qui nomme les outils consultés. Ce n'est
 * pas de la décoration : c'est ce qui distingue « le TEC dit 10 % » de « un
 * modèle croit se souvenir de 10 % ». Le client doit pouvoir faire la
 * différence sans nous croire sur parole.
 */

interface Tour {
  role: 'user' | 'model';
  texte: string;
  outils?: string[];
}

const NOM_OUTILS: Record<string, string> = {
  chercher_position: 'recherche au TEC',
  verifier_position: 'vérification au TEC',
  calculer_droits: 'calcul des droits et taxes',
  chiffrer_operation: 'chiffrage complet',
  regles_de_procedure: 'règles de procédure',
  regimes_douaniers: 'régimes douaniers',
  mes_commandes: 'lecture de vos commandes',
  mes_dossiers_transit: 'lecture de vos dossiers',
  passer_la_main: 'transmis à l’équipe',
  chercher_chez_les_fournisseurs: 'recherche chez nos fournisseurs',
  ouvrir_une_recherche_sourcing: 'recherche de sourcing ouverte',
};

/**
 * Ouvrir Le Déclarant depuis n'importe où, avec une question déjà écrite.
 *
 * La boutique s'en sert quand une recherche ne donne rien : plutôt que de
 * laisser le visiteur sur « aucun résultat », elle lui propose de faire
 * chercher l'article chez les fournisseurs, et lui passe la main sans qu'il
 * ait à retaper ce qu'il cherchait.
 */
export const EVENEMENT_DECLARANT = 'maylary:declarant';

export function ouvrirLeDeclarant(question: string) {
  window.dispatchEvent(new CustomEvent(EVENEMENT_DECLARANT, { detail: { question } }));
}

/** Le nom de l'écran, pour que la réponse tienne compte d'où l'on parle. */
const contexteDeLaRoute = (chemin: string): string => {
  if (chemin.startsWith('/declarant')) return 'Le Déclarant';
  if (chemin.startsWith('/import')) return "demande d'import";
  if (chemin.startsWith('/export')) return "demande d'export";
  if (chemin.startsWith('/boutique/sourcing')) return 'sourcing sur demande';
  if (chemin.startsWith('/boutique')) return 'boutique';
  if (chemin.startsWith('/catalogue')) return 'espace professionnel';
  if (chemin.startsWith('/admin')) return 'administration MayLary Group';
  if (chemin.startsWith('/mon-compte')) return 'espace client';
  return "accueil MayLary Group";
};

// Les suggestions décident de l'idée que le client se fait de l'assistant. Les
// deux premières sont des questions de client, pas de douanier : c'est ce que
// l'on recevra le plus souvent, et c'est ce à quoi Le Déclarant doit répondre
// avant tout le reste.
const SUGGESTIONS = [
  'Où en est ma commande ?',
  'J’ai payé, avez-vous bien reçu ?',
  'Quel incoterm choisir pour un premier import de Chine ?',
  'Combien coûtent les droits sur des pneus de tourisme ?',
];

export default function AssistantDeclarant() {
  const { pathname } = useLocation();
  const [ouvert, setOuvert] = useState(false);
  const [connecte, setConnecte] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [tours, setTours] = useState<Tour[]>([]);
  const [envoi, setEnvoi] = useState(false);
  // Ce qu'il reste de questions pour la journée. Le serveur le renvoie avec
  // chaque réponse : l'afficher évite au client de découvrir son plafond en s'y
  // cognant.
  const [restant, setRestant] = useState<number | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setConnecte(Boolean(data.session)));
    const { data: ecoute } = supabase.auth.onAuthStateChange((_e, session) =>
      setConnecte(Boolean(session)),
    );
    return () => ecoute.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ouvert) finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tours, ouvert, envoi]);

  // Une autre page peut demander l'ouverture avec une question déjà rédigée.
  useEffect(() => {
    const surDemande = (e: Event) => {
      const question = (e as CustomEvent<{ question?: string }>).detail?.question ?? '';
      setOuvert(true);
      if (question) setMessage(question);
    };
    window.addEventListener(EVENEMENT_DECLARANT, surDemande);
    return () => window.removeEventListener(EVENEMENT_DECLARANT, surDemande);
  }, []);

  // L'assistant n'a rien à faire par-dessus l'écran de connexion.
  if (pathname.startsWith('/admin/connexion') || pathname.startsWith('/boutique/compte')) {
    return null;
  }

  const envoyer = async () => {
    const texte = message.trim();
    if (texte.length < 2 || envoi) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setConnecte(false);
      return;
    }

    // Les tours vides sont écartés AVANT l'envoi. Un seul tour sans texte —
    // conversation restaurée d'un ancien format, message interrompu — faisait
    // refuser toute la requête par le fournisseur, et le client lisait « Le
    // Déclarant est momentanément injoignable » : un message faux, qui le
    // pousse à réessayer en boucle avec le même historique cassé.
    const historique = tours
      .filter((t) => typeof t.texte === 'string' && t.texte.trim().length > 0)
      .map((t) => ({ role: t.role, texte: t.texte.trim() }));
    setTours((t) => [...t, { role: 'user', texte }]);
    setMessage('');
    setEnvoi(true);

    try {
      const reponse = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: texte, historique, contexte: contexteDeLaRoute(pathname) }),
      });
      const corps = await reponse.json();
      if (typeof corps.restant === 'number') setRestant(corps.restant);
      setTours((t) => [
        ...t,
        reponse.ok
          ? { role: 'model', texte: corps.reponse as string, outils: corps.outils as string[] }
          : {
              role: 'model',
              texte: (corps?.erreur as string) ?? "Je n'ai pas pu répondre. Réessayez.",
            },
      ]);
    } catch {
      setTours((t) => [
        ...t,
        { role: 'model', texte: 'Le service est injoignable. Vérifiez votre connexion.' },
      ]);
    } finally {
      setEnvoi(false);
    }
  };

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Ouvrir Le Déclarant"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:brightness-95"
      >
        <ShieldCheck className="h-5 w-5" />
        <span className="hidden sm:inline">Le Déclarant</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-x-2 bottom-2 z-40 flex max-h-[85vh] flex-col overflow-hidden rounded-lg border bg-card shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[26rem]">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Le Déclarant</span>
            <span className="block truncate text-xs text-muted-foreground">
              {restant === null
                ? `Logisticien MayLary Group · ${contexteDeLaRoute(pathname)}`
                : `${restant} question${restant > 1 ? 's' : ''} restante${restant > 1 ? 's' : ''} aujourd'hui`}
            </span>
          </span>
        </span>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          aria-label="Fermer"
          className="rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {tours.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Position tarifaire, droits et taxes, incoterm, documents, montage d'un dossier — posez
              votre question. Les chiffres viennent du TEC officiel et des moteurs de calcul, jamais
              de mémoire.
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMessage(s)}
                  className="block w-full rounded border border-dashed px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-muted/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {tours.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-[92%] whitespace-pre-line rounded-lg px-3 py-2 text-left text-sm ${
                t.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {t.texte}
            </div>
            {t.outils && t.outils.length > 0 && (
              <p className="mt-1 flex flex-wrap gap-1">
                {[...new Set(t.outils)].map((o) => (
                  <Badge key={o} variant="secondary" className="text-[10px]">
                    {NOM_OUTILS[o] ?? o}
                  </Badge>
                ))}
              </p>
            )}
          </div>
        ))}

        {envoi && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Il consulte le tarif…
          </p>
        )}
        <div ref={finRef} />
      </div>

      {connecte === false ? (
        <div className="border-t p-3">
          <p className="text-sm text-foreground">
            Connectez-vous pour parler au Déclarant.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            C'est gratuit. Le compte sert à tenir un quota et à garder le fil de vos échanges.
          </p>
          <Button asChild size="sm" className="mt-2">
            <Link to={`/boutique/compte?retour=${encodeURIComponent(pathname)}`}>Se connecter</Link>
          </Button>
        </div>
      ) : (
        <form
          className="flex items-end gap-2 border-t p-2"
          onSubmit={(e) => {
            e.preventDefault();
            envoyer();
          }}
        >
          <Textarea
            rows={2}
            value={message}
            maxLength={4000}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              // Entrée envoie, Maj+Entrée passe à la ligne : l'usage attendu
              // d'une messagerie, pas d'un formulaire.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                envoyer();
              }
            }}
            placeholder="Votre question…"
            className="min-h-0 flex-1 resize-none"
          />
          <Button type="submit" size="icon" disabled={envoi || message.trim().length < 2}>
            {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      )}

      <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        <Sparkles className="mr-1 inline h-3 w-3" />
        Conseil d'aide à la décision. La déclaration en douane est signée par un commissionnaire
        agréé.
      </p>
    </div>
  );
}
