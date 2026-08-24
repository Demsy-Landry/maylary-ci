import { useState } from 'react';
import { toast } from 'sonner';
import { supabase, EDGE_FUNCTIONS_URL } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Tags, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Donner leur prix aux articles qui n'en ont pas encore.
 *
 * POURQUOI CET ÉCRAN N'EXISTAIT PAS, ET POURQUOI IL FALLAIT LE FAIRE
 *
 * La fonction `cj_retarifer` était écrite, déployée et fonctionnelle depuis des
 * semaines — mais AUCUN écran ne l'appelait. J'ai dit au fondateur d'aller
 * cliquer sur un bouton qui n'a jamais existé. Il a eu raison de ne pas le
 * trouver.
 *
 * CE QUE FAIT LA RETARIFICATION, ET POURQUOI ELLE PREND DU TEMPS
 *
 * Pour chaque article, elle redemande au transporteur un devis de transport
 * À CHAQUE PALIER DE QUANTITÉ — un, cinq, vingt, cinquante pièces — puis ne
 * retient que les paliers dont le prix unitaire baisse réellement. C'est ce
 * qui construit la grille de gros, et c'est pourquoi un article coûte moins
 * cher à l'unité quand on en prend cinquante.
 *
 * Le transporteur plafonne à un appel par seconde et chaque article en consomme
 * un par palier. D'où le traitement par lots, et le compteur de restants.
 *
 * POURQUOI DEUX BOUTONS ET PAS UN
 *
 * `Simuler` calcule et montre sans rien écrire. `Appliquer` écrit.
 *
 * La séparation n'est pas de la prudence décorative : la retarification touche
 * les PRIX DE VENTE de tout le catalogue. Voir d'abord ce qu'elle produirait,
 * sur quelques articles, coûte trente secondes et évite de découvrir après coup
 * qu'un réglage de marge mal saisi a reprixé cent articles.
 */

interface Resultat {
  nom: string;
  ancien_prix_fcfa?: number;
  nouveau_prix_fcfa?: number;
  paliers?: number;
  motif?: string;
  retenu?: boolean;
}

interface Reponse {
  success: boolean;
  simulation: boolean;
  resultats: Resultat[];
  restants: number;
}

const fcfa = (n?: number) => (n == null ? '—' : n.toLocaleString('fr-FR'));

export default function RetarifierCatalogue() {
  const [enCours, setEnCours] = useState(false);
  const [simulation, setSimulation] = useState(true);
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [traites, setTraites] = useState(0);

  const lancer = async (mode: 'simulation' | 'application') => {
    setEnCours(true);
    setSimulation(mode === 'simulation');
    setReponse(null);
    setTraites(0);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Session expirée, reconnectez-vous.');

      let restants = 1;
      let cumul = 0;
      let dernier: Reponse | null = null;

      // On relance tant qu'il reste des articles : la fonction traite par lots
      // parce que le transporteur plafonne à un appel par seconde. En
      // simulation on s'arrête au premier lot — il suffit à juger.
      while (restants > 0) {
        const r = await fetch(`${EDGE_FUNCTIONS_URL}/app_e08c374bc4_cj_retarifer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ simulation: mode === 'simulation' }),
        });
        const corps = (await r.json().catch(() => ({}))) as Reponse & { error?: string };
        if (!r.ok) throw new Error(corps.error ?? 'La retarification a échoué.');

        dernier = corps;
        cumul += corps.resultats?.length ?? 0;
        setTraites(cumul);
        restants = mode === 'simulation' ? 0 : (corps.restants ?? 0);
      }

      setReponse(dernier);
      toast.success(
        mode === 'simulation'
          ? `${cumul} article(s) simulé(s) — rien n’a été écrit.`
          : `${cumul} article(s) retarifé(s).`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'La retarification a échoué.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-primary" />
          <CardTitle>Tarifer les nouveaux articles</CardTitle>
        </div>
        <CardDescription>
          Un article importé arrive sans prix et reste invisible. La tarification demande au
          transporteur un devis à chaque quantité — 1, 5, 20, 50 pièces — construit la grille
          dégressive, et met l’article en ligne.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => lancer('simulation')} disabled={enCours}>
            {enCours && simulation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simuler d’abord
          </Button>
          <Button onClick={() => lancer('application')} disabled={enCours}>
            {enCours && !simulation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Appliquer les prix
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          La simulation calcule et affiche sans rien enregistrer. Commencez par elle : la
          tarification touche les prix de vente de tout le catalogue.
        </p>

        {enCours && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {traites} article(s) traité(s)… le transporteur ne répond qu’une fois par seconde.
          </p>
        )}

        {reponse && (
          <div className="overflow-hidden rounded-md border">
            <p className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2 text-sm font-medium">
              {reponse.simulation ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Simulation — rien n’a été enregistré
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Prix enregistrés
                </>
              )}
            </p>
            <div className="max-h-80 overflow-y-auto divide-y">
              {reponse.resultats.map((r, i) => (
                <div key={i} className="px-3 py-2 text-sm">
                  <p className="truncate font-medium text-foreground">{r.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.motif ? (
                      <span className="text-amber-700 dark:text-amber-500">{r.motif}</span>
                    ) : (
                      <>
                        {fcfa(r.ancien_prix_fcfa)} → <strong>{fcfa(r.nouveau_prix_fcfa)} FCFA</strong>
                        {r.paliers ? ` · ${r.paliers} palier(s) de gros` : ''}
                      </>
                    )}
                  </p>
                </div>
              ))}
              {reponse.resultats.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  Aucun article en attente de prix.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
