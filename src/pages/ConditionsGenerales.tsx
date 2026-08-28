import { Link } from 'react-router-dom';
import PublicHeaderGP from '@/components/PublicHeaderGP';
import SiteFooter from '@/components/SiteFooter';
import { ScrollText, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useReferencement } from '@/hooks/useReferencement';

/**
 * Les conditions générales de vente.
 *
 * Elles manquaient, et c'est le genre d'absence qui ne se voit pas tant que
 * tout va bien. Le jour où une commande se passe mal — un colis qui n'arrive
 * pas, un client qui conteste un montant, un vendeur qui réclame son
 * reversement —, rien n'écrit ce qui a été convenu. C'est la parole de l'un
 * contre celle de l'autre, et c'est la maison qui perd, parce que c'est elle
 * qui a rédigé le service.
 *
 * DEUX PARTIS PRIS
 *
 * **Elles décrivent le système RÉEL, pas un modèle recopié.** Les statuts de
 * commande cités sont ceux du code. Le délai de confirmation de réception est
 * celui qui est en base. Le fret séparé du prix des articles est celui que le
 * panier calcule. Des CGV qui décrivent un autre commerce que le sien ne
 * protègent personne : la première contradiction entre le texte et l'écran les
 * rend inopposables.
 *
 * **Elles n'inventent aucun engagement commercial.** Les délais de livraison,
 * les zones desservies et le sort des frais de retour sont des décisions du
 * fondateur, pas du code. Là où la décision manque, le texte dit ce que le
 * système fait aujourd'hui et renvoie au devis — plutôt que d'annoncer au nom
 * de la maison une promesse qu'elle n'a pas prise.
 */

const MAJ = '15 août 2026';

/** Le délai de confirmation de réception, tel qu'il est réglé en base
 *  (`parametres_garantie.delai_confirmation_jours`). Recopié ici en toutes
 *  lettres : un contrat ne se lit pas depuis une requête. Si le réglage
 *  change, cette ligne doit changer avec lui. */
const DELAI_CONFIRMATION_JOURS = 2;

function Article({
  numero,
  titre,
  children,
}: {
  numero: string;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-24" id={`article-${numero}`} data-revele>
      <h2 className="font-display text-lg font-bold text-foreground">
        <span className="text-primary">{numero}.</span> {titre}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function ConditionsGenerales() {
  useReferencement({
    titre: "Conditions générales de vente et de service",
    description:
      "Commande, paiement, garantie « payé, protégé », délais, réclamations et rétractation : les règles qui encadrent nos prestations et nos ventes.",
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeaderGP />

      <main className="entree-page mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          <ScrollText className="h-4 w-4" />
          Cadre contractuel
        </p>
        <h1 className="trait-anime mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground">
          Conditions générales de vente et de prestation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : {MAJ}</p>

        <div className="mt-8 space-y-8">
          <Article numero="1" titre="Objet et champ d’application">
            <p>
              Les présentes conditions régissent les relations entre MayLary Group, nom commercial
              de Dems’Inc, entreprise individuelle exploitée par Demsy Landry, dont le siège est à
              Abidjan (Côte d’Ivoire), ci-après « MayLary Group », et toute personne physique ou
              morale qui commande un produit ou une prestation sur le site, ci-après « le Client ».
            </p>
            <p>Elles couvrent quatre activités distinctes, qui n’obéissent pas aux mêmes règles :</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong className="text-foreground">La vente de marchandises</strong> depuis la
                boutique et l’Espace Pro (articles 4 à 9) ;
              </li>
              <li>
                <strong className="text-foreground">Les prestations de transit</strong> — import,
                export, sourcing, groupage — vendues sur devis (article 10) ;
              </li>
              <li>
                <strong className="text-foreground">La place de marché</strong>, où des vendeurs
                tiers proposent leurs articles (article 11) ;
              </li>
              <li>
                <strong className="text-foreground">Le Déclarant</strong>, outil d’aide au calcul
                douanier, gratuit ou sur abonnement (article 12).
              </li>
            </ul>
            <p>
              Passer commande vaut acceptation sans réserve des présentes. Elles priment sur toute
              condition d’achat du Client, sauf accord écrit contraire.
            </p>
          </Article>

          <Article numero="2" titre="Le rôle exact de MayLary Group en douane">
            <p>
              MayLary Group intervient comme <strong className="text-foreground">transitaire</strong>{' '}
              : organisation du transport, préparation et suivi du dossier documentaire,
              acheminement local.
            </p>
            <p>
              MayLary Group{' '}
              <strong className="text-foreground">
                n’est pas commissionnaire en douane agréé
              </strong>
              . Le dépôt de la déclaration en douane est réalisé par un commissionnaire agréé,
              partenaire de MayLary Group, qui en porte la signature et la responsabilité propre.
              Aucune déclaration ne résulte d’un traitement automatique.
            </p>
          </Article>

          <Article numero="3" titre="Compte client">
            <p>
              La commande suppose un compte. Le Client garantit l’exactitude des informations
              fournies et reste responsable de la confidentialité de son mot de passe. Toute
              commande passée depuis son compte est réputée émaner de lui.
            </p>
            <p>
              Un mot de passe oublié se réinitialise depuis la page de connexion. MayLary Group ne
              connaît jamais le mot de passe d’un Client et ne le demandera jamais, par aucun canal.
            </p>
          </Article>

          <Article numero="4" titre="Prix, fret et taxes">
            <p>
              Les prix sont exprimés en francs CFA (XOF). Le taux de conversion euro/franc CFA
              appliqué est le taux légal fixe de <strong className="text-foreground">655,957</strong>{' '}
              ; aucun taux de change variable n’est utilisé.
            </p>
            <p>
              <strong className="text-foreground">Le fret est séparé du prix des articles</strong> et
              affiché distinctement au panier. Le prix d’un article ne comprend donc pas son
              acheminement : le total à payer est la somme des articles, du fret retenu et, le cas
              échéant, des frais annexes affichés avant validation.
            </p>
            <p>
              Le prix applicable est celui affiché au moment de la validation de la commande.{' '}
              <strong className="text-foreground">
                Un prix ne peut pas être modifié après paiement du Client
              </strong>{' '}
              : une hausse de coût survenue ensuite est supportée par MayLary Group.
            </p>
            <p>
              Pour les marchandises importées, les droits et taxes sont ceux du Tarif Extérieur
              Commun de l’UEMOA en vigueur au jour de la liquidation. Toute estimation communiquée
              avant liquidation est indicative ; seule la liquidation officielle fait foi.
            </p>
          </Article>

          <Article numero="5" titre="Commande et formation du contrat">
            <p>
              La commande suit des étapes visibles dans le suivi du Client :{' '}
              <em>en attente de paiement</em>, <em>paiement reçu — vérification en cours</em>,{' '}
              <em>paiement confirmé</em>, <em>en préparation</em>, <em>expédiée</em>,{' '}
              <em>livrée</em>.
            </p>
            <p>
              Le contrat est formé à la{' '}
              <strong className="text-foreground">confirmation du paiement</strong> par MayLary
              Group, et non à la déclaration de paiement par le Client. Tant que la réception des
              fonds n’est pas vérifiée, la commande reste au statut « vérification en cours » et
              aucun engagement d’expédition n’est pris.
            </p>
            <p>
              MayLary Group peut refuser ou annuler une commande en cas d’indisponibilité, d’erreur
              manifeste de prix, de soupçon de fraude, ou de marchandise dont l’importation est
              réglementée sans que les autorisations requises soient produites. En ce cas, les
              sommes déjà versées sont intégralement remboursées.
            </p>
          </Article>

          <Article numero="6" titre="Paiement">
            <p>
              Les paiements sont acceptés par Mobile Money (Wave, Orange Money, MTN, Moov) et par
              virement bancaire, sur les coordonnées communiquées au moment de la commande.
            </p>
            <p>
              Le Client déclare son règlement depuis son suivi de commande. MayLary Group vérifie
              la réception effective des fonds avant de confirmer.{' '}
              <strong className="text-foreground">
                Une capture d’écran ne vaut pas paiement
              </strong>{' '}
              : seule la réception constatée sur le compte de MayLary Group est prise en compte.
            </p>
            <p>
              MayLary Group ne collecte, ne stocke et ne traite aucune donnée de carte bancaire.
            </p>
          </Article>

          <Article numero="7" titre="Livraison">
            <p>
              La livraison s’effectue en Côte d’Ivoire, à l’adresse indiquée par le Client. Les
              délais annoncés courent à compter de la confirmation du paiement et s’entendent en
              jours ouvrés.
            </p>
            <p>
              Les délais d’acheminement international dépendent de tiers — compagnies maritimes et
              aériennes, administrations, prestataires portuaires. Ils sont communiqués à titre
              prévisionnel. Un retard imputable à ces tiers, à un contrôle douanier, à une grève ou
              à un cas de force majeure ne donne pas lieu à indemnité.
            </p>
            <p>
              Le Client vérifie l’état des colis à la remise. Toute avarie ou manquant doit être
              signalé par écrit dans les{' '}
              <strong className="text-foreground">quarante-huit heures</strong> suivant la
              livraison, avec photographies à l’appui, faute de quoi la marchandise est réputée
              acceptée en l’état.
            </p>
          </Article>

          <Article numero="8" titre="La garantie « payé, protégé »">
            <p>
              MayLary Group conserve les fonds jusqu’à la confirmation de réception par le Client.
              Passé un délai de{' '}
              <strong className="text-foreground">
                {DELAI_CONFIRMATION_JOURS} jours
              </strong>{' '}
              après la livraison constatée sans contestation du Client, la commande est réputée
              confirmée et le reversement au vendeur est libéré.
            </p>
            <p>
              Cette garantie n’est pas une clause de style : elle est inscrite dans le
              fonctionnement du système, et le reversement d’un vendeur tiers ne peut techniquement
              pas être déclenché avant.
            </p>
          </Article>

          <Article numero="9" titre="Rétractation, retours et remboursements">
            <p>
              Conformément aux dispositions du Code de la consommation ivoirien applicables à la
              vente à distance, le Client consommateur dispose d’un droit de rétractation. MayLary
              Group porte ce délai à{' '}
              <strong className="text-foreground">sept (7) jours calendaires</strong> à compter de
              la réception de la marchandise.
            </p>
            <p>
              Le droit de rétractation ne s’applique pas aux marchandises confectionnées ou
              importées spécialement sur commande du Client, ni aux biens descellés ne pouvant être
              renvoyés pour des raisons d’hygiène, ni aux prestations de transit déjà exécutées.
            </p>
            <p>
              La marchandise est retournée complète, dans son état d’origine. Le remboursement
              intervient dans les quatorze jours suivant la réception du retour, par le canal ayant
              servi au paiement.
            </p>
            <p className="rounded-md border border-dashed p-3">
              <strong className="text-foreground">Frais de retour.</strong> Ils sont à la charge de
              MayLary Group lorsque le retour résulte d’une erreur de sa part, d’un article non
              conforme ou endommagé. Ils restent à la charge du Client dans les autres cas.
            </p>
          </Article>

          <Article numero="10" titre="Prestations de transit vendues sur devis">
            <p>
              Les demandes d’import, d’export, de sourcing et de groupage font l’objet d’un devis
              nominatif, détaillé poste par poste. Le devis mentionne sa durée de validité ; il
              cesse d’engager MayLary Group au-delà.
            </p>
            <p>
              Chaque demande acceptée donne lieu à l’ouverture d’un{' '}
              <strong className="text-foreground">dossier numéroté</strong> réunissant l’ensemble
              des pièces jusqu’au bordereau de livraison, puis à sa clôture et son archivage. Le
              Client fournit les pièces qui lui incombent ; MayLary Group ne peut être tenu
              responsable des surcoûts, pénalités ou immobilisations résultant d’une pièce
              manquante, tardive ou inexacte de son fait.
            </p>
            <p>
              Les montants de droits et taxes figurant au devis sont estimatifs jusqu’à la
              liquidation officielle. L’écart constaté est refacturé ou remboursé à l’euro près,
              sur justificatif.
            </p>
          </Article>

          <Article numero="11" titre="Place de marché — vendeurs tiers">
            <p>
              Certains articles sont proposés par des vendeurs indépendants inscrits sur MayLary
              Group. Ils sont identifiés comme tels sur la fiche produit. Le vendeur est le
              cocontractant du Client pour la vente ; MayLary Group agit comme intermédiaire
              technique, sécurise le paiement et suit la livraison.
            </p>
            <p>
              Le reversement au vendeur n’intervient qu’après confirmation de réception par le
              Client, dans les conditions de l’article 8. Un vendeur dont les manquements sont
              constatés peut être suspendu.
            </p>
          </Article>

          <Article numero="12" titre="Le Déclarant — portée et limites">
            <p>
              Le Déclarant est un{' '}
              <strong className="text-foreground">outil d’aide à la décision</strong>. Il recherche
              une position tarifaire, propose un classement et calcule des droits et taxes à partir
              du corpus du Tarif Extérieur Commun chargé en base.
            </p>
            <p>
              Lorsqu’un code n’est pas confirmé dans ce corpus,{' '}
              <strong className="text-foreground">aucun taux n’est affiché</strong> : l’outil le
              signale plutôt que de combler le vide par une estimation.
            </p>
            <p>
              Les résultats ne constituent ni une déclaration en douane, ni un avis de classement
              opposable à l’administration, ni un conseil juridique ou fiscal. Le bulletin de
              liquidation produit porte cette mention. La responsabilité de MayLary Group ne saurait
              être engagée à raison d’une décision prise sur le seul fondement de ces résultats.
            </p>
            <p>
              Les formules d’abonnement, leurs plafonds quotidiens et leurs tarifs sont ceux
              affichés sur la page d’abonnement au jour de la souscription. Une modification
              tarifaire ne s’applique jamais à une période déjà réglée.
            </p>
          </Article>

          <Article numero="13" titre="Marchandises réglementées et prohibées">
            <p>
              Le Client garantit que les marchandises commandées ou confiées ne sont ni prohibées,
              ni contrefaisantes, ni soumises à une autorisation qu’il ne détiendrait pas. Certaines
              importations exigent des pièces spécifiques — agrément sanitaire, phytosanitaire,
              certificat BURIDA, autorisation de filière — dont l’obtention lui incombe.
            </p>
            <p>
              MayLary Group refuse toute opération portant sur des marchandises prohibées et se
              réserve d’en informer les autorités compétentes.
            </p>
          </Article>

          <Article numero="14" titre="Responsabilité">
            <p>
              MayLary Group est tenue d’une obligation de moyens dans l’organisation du transport et
              la constitution des dossiers. Sa responsabilité est limitée au préjudice direct et
              prévisible, et ne peut excéder le montant hors taxes effectivement encaissé au titre
              de l’opération concernée.
            </p>
            <p>
              Sont exclus les préjudices indirects : perte d’exploitation, perte de marché, manque à
              gagner, atteinte à l’image.
            </p>
            <p>
              Les limitations qui précèdent ne s’appliquent ni en cas de faute lourde ou dolosive,
              ni dans les cas où la loi ivoirienne les écarte, notamment au bénéfice du
              consommateur.
            </p>
          </Article>

          <Article numero="15" titre="Données personnelles">
            <p>
              Les traitements de données sont décrits dans{' '}
              <Link to="/confidentialite" className="font-medium text-primary hover:underline">
                la politique de confidentialité
              </Link>
              . Le site n’utilise aucun cookie ni traceur : le détail figure sur{' '}
              <Link to="/cookies" className="font-medium text-primary hover:underline">
                la page dédiée
              </Link>
              .
            </p>
          </Article>

          <Article numero="16" titre="Réclamations, médiation et droit applicable">
            <p>
              Toute réclamation est adressée à{' '}
              <a href="mailto:yaolandry67@gmail.com" className="text-primary hover:underline">
                yaolandry67@gmail.com
              </a>
              . MayLary Group s’engage à en accuser réception sous deux jours ouvrés et à y répondre
              sous quinze jours.
            </p>
            <p>
              Les parties recherchent une solution amiable avant toute action. À défaut d’accord,
              les présentes sont régies par le droit ivoirien et le litige relève des juridictions
              compétentes d’Abidjan, sous réserve des règles protectrices du consommateur qui lui
              permettent de saisir la juridiction de son domicile.
            </p>
          </Article>

          <Article numero="17" titre="Modification des présentes">
            <p>
              MayLary Group peut modifier les présentes. Les conditions applicables à une commande
              sont celles en vigueur au jour de sa validation ; une modification postérieure ne lui
              est pas opposable.
            </p>
          </Article>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <div className="flex flex-1 items-start gap-3 rounded-xl border bg-muted/30 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Votre argent n’est versé au vendeur qu’après votre confirmation de réception. Ce n’est
              pas une promesse commerciale : c’est le fonctionnement du système, décrit à
              l’article 8.
            </p>
          </div>
          <div className="flex flex-1 items-start gap-3 rounded-xl border bg-muted/30 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Un doute sur une clause avant de commander ? Écrivez-nous : une commande passée dans
              un malentendu coûte plus cher à tout le monde qu’une question posée avant.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
