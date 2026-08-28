import { Link } from 'react-router-dom';
import PublicHeaderImport from '@/components/PublicHeaderImport';
import SiteFooter from '@/components/SiteFooter';
import { useReferencement } from '@/hooks/useReferencement';

/**
 * Mentions légales.
 *
 * Trois sections ont été ajoutées parce que l'application fait désormais trois
 * choses qu'elle ne faisait pas : elle calcule des droits de douane, elle fait
 * parler un assistant automatique, et elle s'apprête à facturer un abonnement.
 * Chacune engage la responsabilité de l'éditeur d'une manière différente, et
 * une page qui n'en dirait rien serait une page qui protège mal.
 *
 * La formulation évite la clause d'exonération générale, qui ne protège
 * personne et se retourne devant un juge. Elle dit précisément ce que l'outil
 * fait, ce qu'il ne fait pas, et qui signe.
 */
export default function MentionsLegales() {
  useReferencement({
    titre: "Mentions légales",
    description:
      "Éditeur du site, hébergement, propriété intellectuelle et coordonnées de MayLary Group, marque de Dems'Inc.",
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderImport />
      <main className="entree-page mx-auto max-w-screen-md px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold text-foreground">Mentions légales</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : 9 août 2026
        </p>

        <div className="mt-8 space-y-8">
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Éditeur du site</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              MayLary Group est édité par Demsy Landry, exerçant sous le nom commercial Dems'Inc
              (entreprise individuelle).
              <br />
              Directeur de la publication : Demsy Landry.
              <br />
              Localité : Abidjan, Côte d'Ivoire.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Activité</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              MayLary Group propose des prestations de commission de transport et de transit
              (import, export, sourcing, groupage), la vente de marchandises en ligne, et des outils
              d'aide à la décision douanière réunis sous le nom « Le Déclarant ».
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Les opérations de dédouanement sont réalisées par un commissionnaire en douane agréé.
              Le dépôt d'une déclaration en douane engage la signature de ce commissionnaire : elle
              ne résulte jamais d'un traitement automatique.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">
              Le Déclarant — portée et limites
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Les taux de droits de douane affichés proviennent du Tarif Extérieur Commun de
              l'UEMOA appliqué en Côte d'Ivoire. Lorsqu'une position tarifaire n'est pas confirmée
              dans ce corpus, <strong className="text-foreground">aucun taux n'est affiché</strong> :
              l'outil signale l'absence plutôt que de proposer une estimation.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Les résultats et le bulletin imprimable constituent une aide au calcul. Ils ne
              remplacent ni la déclaration officielle déposée dans le système douanier, ni la
              liquidation établie par l'administration. La classification tarifaire engage le
              déclarant : en cas de doute, un renseignement tarifaire contraignant peut être demandé
              à la Direction générale des douanes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Assistant automatique</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              L'assistant « Le Déclarant » repose sur un modèle de langage. Il est configuré pour ne
              produire aucun chiffre de sa propre initiative : les positions tarifaires, taux,
              montants et délais qu'il rapporte proviennent des bases de référence de
              l'application, et les outils consultés sont affichés sous chaque réponse.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ses réponses restent un avis d'aide à la décision. Elles n'engagent ni la
              responsabilité douanière, ni un prix ferme, ni un accord contractuel. Les échanges
              sont transmis au fournisseur du modèle pour traitement.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">
              Cotations et prix
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Un chiffrage présenté comme incomplet l'est réellement : l'application nomme les
              postes dont le tarif n'est pas encore établi plutôt que de les estimer. Seul un devis
              émis par MayLary Group engage l'entreprise. Les frais de transport, de manutention
              portuaire et de magasinage dépendent de barèmes de tiers et des délais effectifs de
              traitement du dossier.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Un prix accepté par un client ne fait pas l'objet d'une révision après paiement.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">
              Formules d'accès à l'assistant
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              L'accès à l'assistant automatique est proposé selon des formules assorties d'un
              plafond de requêtes journalier. Les fonctions de recherche tarifaire et de calcul des
              droits et taxes restent accessibles sans plafond. Le plafond restant est affiché avant
              chaque envoi.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Hébergement</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Application : Vercel Inc.
              <br />
              Base de données, authentification et fichiers : Supabase.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">
              Propriété intellectuelle
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Les contenus de ce site — textes, marque, logo, visuels, structure — sont la propriété
              de Dems'Inc, sauf mention contraire. Le Tarif Extérieur Commun et la nomenclature des
              régimes douaniers sont des documents officiels reproduits à titre de référence.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Données personnelles</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Le traitement de vos données est décrit dans notre{' '}
              <Link to="/confidentialite" className="text-primary hover:underline">
                politique de protection des données
              </Link>{' '}
              : ce que nous collectons, pourquoi, combien de temps, et comment exercer vos droits au
              titre de la loi n° 2013-450 du 19 juin 2013.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Contact</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Téléphone : +225 07 67 55 67 65
              <br />
              Email :{' '}
              <a href="mailto:yaolandry67@gmail.com" className="text-primary hover:underline">
                yaolandry67@gmail.com
              </a>
              <br />
              Localité : Abidjan, Côte d'Ivoire
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
