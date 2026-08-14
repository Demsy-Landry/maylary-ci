import { Link } from 'react-router-dom';
import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';
import { ShieldCheck, Lock, Clock, UserCheck, Server, AlertTriangle } from 'lucide-react';

/** Date de la dernière révision de fond, affichée au lecteur. */
const DERNIERE_MISE_A_JOUR = '4 août 2026';

/**
 * Politique de protection des données personnelles.
 *
 * Écrite à partir d'un inventaire réel de la base : chaque donnée citée ici
 * existe dans une colonne, et chaque protection décrite a été éprouvée avant
 * d'être annoncée. Une politique qui promet des mesures non vérifiées est pire
 * que pas de politique — elle engage sans protéger.
 *
 * Cadre applicable : loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la
 * protection des données à caractère personnel, autorité de contrôle ARTCI.
 */
export default function Confidentialite() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderImport />
      <main className="entree-page mx-auto max-w-screen-md px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Protection de vos données personnelles
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : {DERNIERE_MISE_A_JOUR}
        </p>

        <p className="mt-6 text-sm text-foreground">
          MayLary Group vend en ligne et organise des transports internationaux. Les deux exigent de
          savoir qui vous êtes et où livrer. Cette page dit exactement ce que nous gardons, pourquoi,
          combien de temps, et ce que vous pouvez exiger de nous.
        </p>

        <div className="mt-10 space-y-10">
          <section>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Server className="h-5 w-5 text-primary" />
              Qui traite vos données
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Le responsable du traitement est Demsy Landry, exerçant sous le nom commercial
              Dems'Inc, à Abidjan (Côte d'Ivoire). Pour toute question ou demande relative à vos
              données :{' '}
              <a href="mailto:yaolandry67@gmail.com" className="text-primary hover:underline">
                yaolandry67@gmail.com
              </a>{' '}
              ou +225 07 67 55 67 65.
            </p>
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <UserCheck className="h-5 w-5 text-primary" />
              Ce que nous collectons, et pourquoi
            </h2>

            {/* Le tableau reprend l'inventaire réel des colonnes de la base.
                Annoncer moins que ce qui est stocké serait un mensonge par
                omission ; annoncer plus alarmerait sans raison. */}
            <div className="mt-3 overflow-x-auto rounded-md border">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="bg-muted/50 text-left text-xs font-medium text-foreground">
                  <tr>
                    <th className="px-3 py-2">Donnée</th>
                    <th className="px-3 py-2">Pourquoi</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-muted-foreground">
                  <tr>
                    <td className="px-3 py-2">Adresse e-mail et mot de passe</td>
                    <td className="px-3 py-2">
                      Ouvrir votre compte et vous y reconnecter. Le mot de passe n'est jamais stocké
                      en clair : seule une empreinte chiffrée l'est, et nous ne pouvons pas le lire.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Nom, téléphone, ville</td>
                    <td className="px-3 py-2">
                      Vous joindre au sujet d'une commande et établir vos factures.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Adresse de livraison</td>
                    <td className="px-3 py-2">
                      Livrer. Elle est transmise au transporteur qui achemine votre colis.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Nom de votre entreprise, secteur d'activité</td>
                    <td className="px-3 py-2">
                      Vous adresser des devis professionnels adaptés, si vous utilisez l'Espace Pro.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Commandes, devis, demandes d'import et d'export</td>
                    <td className="px-3 py-2">
                      Exécuter ce que vous nous demandez, et tenir notre comptabilité.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Référence de transaction et reçu de paiement</td>
                    <td className="px-3 py-2">
                      Vérifier qu'un règlement nous est bien parvenu, et vous protéger d'une
                      contestation. Le reçu est déposé dans un espace privé.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Documents que vous nous transmettez</td>
                    <td className="px-3 py-2">
                      Factures, connaissements, déclarations douanières nécessaires au dédouanement.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Avis que vous publiez</td>
                    <td className="px-3 py-2">
                      Renseigner les autres acheteurs. Votre avis s'affiche sous un nom abrégé
                      (prénom et initiale) — jamais votre nom complet, ni votre commande.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              Nous ne collectons aucune donnée de santé, d'opinion, d'origine ou de religion, et
              nous ne pratiquons ni profilage publicitaire, ni décision automatisée vous concernant.
            </p>
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Lock className="h-5 w-5 text-primary" />
              Comment vos données sont protégées
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              La protection ne repose pas sur la discrétion de nos écrans, mais sur des règles
              appliquées par la base de données elle-même, à chaque requête. Elles ont été mises à
              l'épreuve, et voici ce qui a été mesuré :
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Un visiteur non connecté ne lit <strong>aucune</strong> donnée personnelle : ni
                  profil, ni commande, ni facture, ni document.
                </span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Un client connecté ne voit que ses propres données. Vérifié avec un compte
                  ordinaire face aux commandes d'un autre client : aucune ligne visible.
                </span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Vos documents et reçus sont dans des espaces privés, sans adresse publique. Ils
                  ne s'ouvrent que par un lien signé à durée limitée : dix minutes pour un reçu de
                  paiement, une heure pour un document de transit que vous téléchargez.
                </span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Les échanges entre votre navigateur et nos serveurs sont chiffrés (HTTPS), sans
                  exception.
                </span>
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Nous n'avons jamais accès à votre mot de passe, ni à vos identifiants bancaires ou
                  Mobile Money : vous payez chez votre opérateur, pas sur notre site.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Server className="h-5 w-5 text-primary" />
              Où vos données sont hébergées, et avec qui elles sont partagées
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Nos serveurs sont opérés par Supabase, et l'application est diffusée par Vercel. Vos
              données sont donc hébergées hors de Côte d'Ivoire, chez des prestataires soumis à
              leurs propres obligations de sécurité.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Nous transmettons le strict nécessaire, et seulement pour exécuter votre commande :
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                à notre fournisseur et au transporteur : le nom, le téléphone et l'adresse du
                destinataire, sans lesquels aucun colis ne peut partir ;
              </li>
              <li>
                à l'administration douanière, lorsque la loi l'exige pour le dédouanement de vos
                marchandises.
              </li>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              Nous ne vendons vos données à personne, et nous ne les cédons à aucun annonceur.
            </p>
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Server className="h-5 w-5 text-primary" />
              Ce qui part vers l'assistant automatique
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Quand vous décrivez une marchandise à classer ou posez une question au Déclarant,{' '}
              <strong className="text-foreground">le texte que vous écrivez</strong> est transmis au
              fournisseur du modèle de langage pour être traité. Rien d'autre ne part : ni votre nom,
              ni votre adresse, ni vos commandes, ni votre identifiant de compte.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Les résultats consultés par l'assistant dans nos bases — positions tarifaires, taux,
              régimes — accompagnent ce texte, parce qu'il doit les lire pour vous répondre. Ce sont
              des données publiques de référence, pas les vôtres.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Vos classifications et vos échanges sont conservés sur votre compte pour que vous
              puissiez les retrouver et défendre un classement des mois plus tard. Vous pouvez les
              supprimer vous-même à tout moment. Nous enregistrons également le volume consommé par
              chaque requête, pour tenir votre quota et connaître notre coût — jamais le contenu à
              cette fin.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Une conséquence pratique, et elle mérite d'être dite franchement : n'écrivez pas à
              l'assistant ce que vous ne confieriez pas à un tiers. Décrire une marchandise ne pose
              aucun problème ; y recopier un contrat, un relevé bancaire ou les coordonnées d'un
              client en pose un.
            </p>
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Clock className="h-5 w-5 text-primary" />
              Combien de temps nous les gardons
            </h2>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Votre compte</strong> : tant qu'il existe. Vous
                pouvez demander sa fermeture à tout moment.
              </li>
              <li>
                <strong className="text-foreground">Commandes, factures et pièces de règlement</strong>{' '}
                : dix ans après la transaction. Ce délai n'est pas notre choix — c'est celui que la
                réglementation comptable et fiscale impose à toute entreprise. Nous ne pouvons pas
                les effacer avant, même à votre demande.
              </li>
              <li>
                <strong className="text-foreground">Documents de transit et de douane</strong> : le
                temps exigé par la réglementation douanière.
              </li>
              <li>
                <strong className="text-foreground">Vos avis</strong> : tant qu'ils sont publiés.
                Vous pouvez en demander le retrait.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <UserCheck className="h-5 w-5 text-primary" />
              Vos droits
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              La loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à
              caractère personnel vous reconnaît le droit d'accéder à vos données, de les faire
              rectifier, de vous opposer à leur traitement et d'en demander l'effacement.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Vous corrigez vous-même votre nom, votre téléphone et votre adresse depuis{' '}
              <Link to="/mon-compte" className="text-primary hover:underline">
                Mon compte
              </Link>
              , et vous y retrouvez l'historique complet de vos commandes et demandes. Pour toute
              autre demande — copie de vos données, fermeture de compte, retrait d'un avis — écrivez
              à{' '}
              <a href="mailto:yaolandry67@gmail.com" className="text-primary hover:underline">
                yaolandry67@gmail.com
              </a>
              . Nous répondons sous trente jours.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Si notre réponse ne vous satisfait pas, vous pouvez saisir l'Autorité de Régulation
              des Télécommunications de Côte d'Ivoire (ARTCI), autorité de contrôle en matière de
              données personnelles.
            </p>
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <AlertTriangle className="h-5 w-5 text-primary" />
              En cas d'incident
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Si un incident venait à exposer vos données, nous vous en informerions directement,
              avec ce que nous savons : ce qui a été touché, quand, et ce que vous devez faire.
              Nous ne le découvririez pas par un tiers.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Cookies et mesure d'audience</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Nous n'utilisons aucun cookie publicitaire et aucun traceur tiers. Votre navigateur
              conserve uniquement ce qui est nécessaire au fonctionnement du site : votre session de
              connexion et le contenu de votre panier, qui ne quitte pas votre appareil tant que
              vous n'avez pas validé votre commande.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Évolution de cette politique</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cette page évolue avec le service. Toute modification de fond sera signalée par la date
              de mise à jour en tête de page. Voir aussi nos{' '}
              <Link to="/mentions-legales" className="text-primary hover:underline">
                mentions légales
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
