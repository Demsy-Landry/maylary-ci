import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { Link } from 'react-router-dom';
import { INVENTAIRE_STOCKAGE } from '@/lib/stockage-local';
import { Cookie, ShieldOff, HardDrive, Trash2, CheckCircle2 } from 'lucide-react';
import { useReferencement } from '@/hooks/useReferencement';
import { PAGES } from '@/lib/referencement-pages';

/**
 * La page « cookies » d'un site qui n'en pose aucun.
 *
 * La tentation serait de recopier le texte type qu'on trouve partout —
 * « cookies fonctionnels, cookies analytiques, cookies de personnalisation ».
 * Ce serait faux, et faux d'une manière vérifiable en dix secondes par
 * n'importe qui ouvrant les outils de développement. Un site qui ment sur ses
 * cookies fait douter de tout le reste, y compris de ses prix.
 *
 * Cette page dit donc ce qui est : trois entrées de stockage local, nommées,
 * avec leur rôle et leur durée, et rien d'autre. La liste est lue depuis le
 * module qui la définit, pas recopiée ici — deux copies finissent toujours
 * par diverger, et celle qui diverge est celle qu'on montre au public.
 */
export default function Cookies() {
  useReferencement(PAGES["/cookies"]);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />

      <main className="entree-page mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          <Cookie className="h-4 w-4" />
          Cookies et stockage local
        </p>
        <h1 className="trait-anime mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground">
          Ce site n’utilise aucun cookie
        </h1>
        <p className="mt-4 max-w-prose leading-relaxed text-muted-foreground">
          Ce n’est pas une formule de style. Le code de ce site ne contient pas une seule
          instruction qui écrive un cookie, et sa politique de sécurité de contenu interdit
          techniquement le chargement de tout script venu d’un autre domaine. Vous pouvez le
          vérifier vous-même : ouvrez les outils de développement de votre navigateur, onglet
          « Application », section « Cookies ». Elle est vide.
        </p>

        {/* Ce qui n'existe pas, nommément. Une liste de négations est plus
            informative qu'une affirmation générale : elle se vérifie. */}
        <section className="mt-8 rounded-xl border bg-muted/30 p-5" data-revele>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <ShieldOff className="h-4 w-4 text-primary" />
            Ce que nous n’avons pas
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              'Aucun cookie, de quelque nature que ce soit',
              'Aucune mesure d’audience (ni Google Analytics, ni autre)',
              'Aucun pixel publicitaire (Meta, TikTok, Google Ads)',
              'Aucun bouton de réseau social qui vous suive',
              'Aucune police de caractères chargée depuis un tiers',
              'Aucune revente ni partage de données à des fins commerciales',
            ].map((l) => (
              <li key={l} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Ce qui existe réellement. */}
        <section className="mt-8" data-revele>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <HardDrive className="h-4 w-4 text-primary" />
            Ce qui est gardé sur votre appareil
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Trois entrées, dans l’espace de stockage local de votre navigateur. Elles ne quittent
            jamais votre appareil : contrairement aux cookies, ce stockage n’est pas joint aux
            requêtes envoyées au serveur. Nous ne pouvons pas les lire à distance.
          </p>

          <div className="mt-5 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[38rem] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Entrée</th>
                  <th className="px-4 py-2.5">À quoi elle sert</th>
                  <th className="px-4 py-2.5">Combien de temps</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {INVENTAIRE_STOCKAGE.map((e) => (
                  <tr key={e.cle} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{e.libelle}</p>
                      <code className="mt-0.5 block break-all text-xs text-muted-foreground">
                        {e.cle}
                      </code>
                    </td>
                    <td className="px-4 py-3 leading-relaxed text-muted-foreground">{e.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.duree}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 rounded-md border border-dashed p-3 text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Pourquoi il n’y a pas de bouton « Refuser ».</strong>{' '}
            Ces trois entrées sont ce qu’on appelle du stockage strictement nécessaire : les
            refuser ne vous protégerait de rien et viderait votre panier à chaque page. Le
            consentement préalable s’impose aux traceurs de mesure et de publicité — nous n’en
            avons aucun. Un bouton « Refuser » qui casse le service serait un piège, pas un choix.
          </p>
        </section>

        <section className="mt-8" data-revele>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Trash2 className="h-4 w-4 text-primary" />
            Comment tout effacer
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Vous en gardez le contrôle complet, sans nous demander quoi que ce soit. Se déconnecter
            supprime la session. Vider le panier supprime le panier. Et le réglage
            « Effacer les données de navigation » de votre navigateur, pour ce site, supprime tout
            d’un coup — vous serez simplement déconnecté et votre panier sera vide.
          </p>
        </section>

        <section className="mt-8 rounded-xl border bg-card p-5" data-revele>
          <h2 className="font-display text-base font-bold text-foreground">
            Et si cela change un jour ?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Si nous mettons en place une mesure d’audience, elle ne se déclenchera qu’après votre
            accord explicite, et cette page sera mise à jour avant. L’application est construite
            ainsi : aucun traceur ne peut être déposé sans passer par une autorisation qui, à ce
            jour, est fermée.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Voir aussi{' '}
            <Link to="/confidentialite" className="font-medium text-primary hover:underline">
              la politique de confidentialité
            </Link>{' '}
            et{' '}
            <Link to="/mentions-legales" className="font-medium text-primary hover:underline">
              les mentions légales
            </Link>
            .
          </p>
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Une question sur vos données ?{' '}
          <a href="mailto:yaolandry67@gmail.com" className="text-primary hover:underline">
            yaolandry67@gmail.com
          </a>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
