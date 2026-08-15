import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { CartGPProvider } from '@/hooks/useCartGP';
import { CartProvider } from '@/hooks/useCart';
import AdminRoute from '@/components/AdminRoute';
import Index from '@/pages/Index';
import Couverture from '@/pages/Couverture';
import CatalogueGrandPublic from '@/pages/CatalogueGrandPublic';
import BandeauStockage from '@/components/BandeauStockage';
import PageIntrouvable from '@/pages/PageIntrouvable';
import TransitionDePage from '@/components/TransitionDePage';
import AssistantDeclarant from '@/components/AssistantDeclarant';
import { demarrerRevelation } from '@/lib/revelation';

/* ---------------------------------------------------------------------------
   Le chargement à la demande, et pourquoi il fallait le faire maintenant.

   Tout le site partait en un seul fichier de 1,5 Mo — écrans d'administration
   compris, et avec eux jsPDF et html2canvas qui ne servent qu'à imprimer une
   facture. Un client d'Abidjan qui ouvre la boutique sur une liaison mobile
   téléchargeait donc l'atelier de cotation, la comptabilité et le générateur
   de PDF avant de voir le premier produit.

   Restent chargées d'emblée les trois portes d'entrée réelles — la couverture,
   la page des services, la boutique — et l'écran d'adresse inconnue. Tout le
   reste arrive quand on y va.
--------------------------------------------------------------------------- */
const APropos = lazy(() => import('@/pages/APropos'));
const AchatsGroupes = lazy(() => import('@/pages/AchatsGroupes'));
const AdminAchatsGroupesGestion = lazy(() => import('@/pages/admin/AchatsGroupesGestion'));
const AdminAssistance = lazy(() => import('@/pages/admin/Assistance'));
const AdminCommandesGP = lazy(() => import('@/pages/admin/CommandesGP'));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminDeclarantGestion = lazy(() => import('@/pages/admin/DeclarantGestion'));
const AdminProduitsGestion = lazy(() => import('@/pages/admin/ProduitsGestion'));
const AdminDevisGestion = lazy(() => import('@/pages/admin/DevisGestion'));
const AdminDossiersGestion = lazy(() => import('@/pages/admin/DossiersGestion'));
const AdminEquipeGestion = lazy(() => import('@/pages/admin/EquipeGestion'));
const AdminExportGestion = lazy(() => import('@/pages/admin/ExportGestion'));
const AdminImportGestion = lazy(() => import('@/pages/admin/ImportGestion'));
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'));
const AdminParametres = lazy(() => import('@/pages/admin/AdminParametres'));
const AdminSourcingGestion = lazy(() => import('@/pages/admin/SourcingGestion'));
const AdminVendeursGestion = lazy(() => import('@/pages/admin/VendeursGestion'));
const CatalogueCategorieGP = lazy(() => import('@/pages/CatalogueCategorieGP'));
const CataloguePro = lazy(() => import('@/pages/CataloguePro'));
const CatalogueSecteurPro = lazy(() => import('@/pages/CatalogueSecteurPro'));
const CjDropshippingImport = lazy(() => import('@/pages/admin/CjDropshippingImport'));
const CommandeGP = lazy(() => import('@/pages/CommandeGP'));
const Comptabilite = lazy(() => import('@/pages/admin/Comptabilite'));
const CompteGP = lazy(() => import('@/pages/CompteGP'));
const ConditionsGenerales = lazy(() => import('@/pages/ConditionsGenerales'));
const Confidentialite = lazy(() => import('@/pages/Confidentialite'));
const Cookies = lazy(() => import('@/pages/Cookies'));
const Declarant = lazy(() => import('@/pages/Declarant'));
const DeclarantAbonnement = lazy(() => import('@/pages/DeclarantAbonnement'));
const DeclarantAccueil = lazy(() => import('@/pages/DeclarantAccueil'));
const DeclarantHistorique = lazy(() => import('@/pages/DeclarantHistorique'));
const DeclarantTableauDeBord = lazy(() => import('@/pages/DeclarantTableauDeBord'));
const EspaceVendeur = lazy(() => import('@/pages/EspaceVendeur'));
const Fournisseurs = lazy(() => import('@/pages/admin/Fournisseurs'));
const MentionsLegales = lazy(() => import('@/pages/MentionsLegales'));
const MesCommandesGP = lazy(() => import('@/pages/MesCommandesGP'));
const MesDemandesExport = lazy(() => import('@/pages/MesDemandesExport'));
const MesDemandesImport = lazy(() => import('@/pages/MesDemandesImport'));
const MesDevis = lazy(() => import('@/pages/MesDevis'));
const MonCompte = lazy(() => import('@/pages/MonCompte'));
const MotDePasseOublie = lazy(() => import('@/pages/MotDePasseOublie'));
const NouvelleDemandeExport = lazy(() => import('@/pages/NouvelleDemandeExport'));
const NouvelleDemandeImport = lazy(() => import('@/pages/NouvelleDemandeImport'));
const PanierAchat = lazy(() => import('@/pages/PanierAchat'));
const PanierDevis = lazy(() => import('@/pages/PanierDevis'));
const PoidsTaxable = lazy(() => import('@/pages/PoidsTaxable'));
const ProduitDetailGP = lazy(() => import('@/pages/ProduitDetailGP'));
const ProduitDetailPro = lazy(() => import('@/pages/ProduitDetailPro'));
const ProspectionFournisseurs = lazy(() => import('@/pages/admin/ProspectionFournisseurs'));
const QualiteFournisseurs = lazy(() => import('@/pages/admin/QualiteFournisseurs'));
const SourcingGP = lazy(() => import('@/pages/SourcingGP'));

const queryClient = new QueryClient();

function App() {
  // Un seul observateur pour toute l'application, monté avec elle.
  useEffect(() => demarrerRevelation(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartGPProvider>
          <CartProvider>
            <BrowserRouter>
              <TransitionDePage>
              {/* L'attente pendant qu'un écran différé arrive.
                  Volontairement discrète : sur une bonne liaison, elle dure
                  cinquante millisecondes, et un grand écran de chargement qui
                  clignote à chaque navigation est pire que rien. */}
              <Suspense
                fallback={
                  <div
                    className="flex min-h-screen items-center justify-center bg-background"
                    role="status"
                    aria-label="Chargement"
                  >
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
                  </div>
                }
              >
              <Routes>
                {/* La couverture ouvre l'application ; l'ancienne page d'accueil,
                    qui présente les services un à un, devient la seconde. */}
                <Route path="/" element={<Couverture />} />
                <Route path="/services" element={<Index />} />
                <Route path="/import" element={<NouvelleDemandeImport />} />
                <Route path="/import/nouvelle-demande" element={<NouvelleDemandeImport />} />
                <Route path="/import/mes-demandes" element={<MesDemandesImport />} />
                <Route path="/export" element={<NouvelleDemandeExport />} />
                <Route path="/export/nouvelle-demande" element={<NouvelleDemandeExport />} />
                <Route path="/export/mes-demandes" element={<MesDemandesExport />} />
                <Route path="/boutique" element={<CatalogueGrandPublic />} />
                <Route path="/boutique/categorie/:categorieId" element={<CatalogueCategorieGP />} />
                <Route path="/boutique/produit/:produitId" element={<ProduitDetailGP />} />
                <Route path="/boutique/panier" element={<PanierAchat />} />
                <Route path="/boutique/commande" element={<CommandeGP />} />
                <Route path="/boutique/compte" element={<CompteGP />} />
                <Route path="/boutique/mes-commandes" element={<MesCommandesGP />} />
                <Route path="/boutique/achats-groupes" element={<AchatsGroupes />} />
                <Route path="/declarant" element={<DeclarantAccueil />} />
                <Route path="/declarant/atelier" element={<Declarant />} />
                <Route path="/declarant/tableau-de-bord" element={<DeclarantTableauDeBord />} />
                <Route path="/declarant/historique" element={<DeclarantHistorique />} />
                <Route path="/declarant/abonnement" element={<DeclarantAbonnement />} />
                <Route path="/poids-taxable" element={<PoidsTaxable />} />
                <Route path="/boutique/sourcing" element={<SourcingGP />} />
                <Route path="/vendre" element={<EspaceVendeur />} />
                <Route path="/vendre/espace" element={<EspaceVendeur />} />
                <Route path="/catalogue" element={<CataloguePro />} />
                <Route path="/catalogue/secteur/:secteurId" element={<CatalogueSecteurPro />} />
                <Route path="/catalogue/produit/:produitId" element={<ProduitDetailPro />} />
                <Route path="/catalogue/devis" element={<PanierDevis />} />
                <Route path="/catalogue/mes-devis" element={<MesDevis />} />
                <Route path="/mon-compte" element={<MonCompte />} />
                <Route path="/admin/connexion" element={<AdminLogin />} />
                <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
                <Route path="/a-propos" element={<APropos />} />
                <Route path="/mentions-legales" element={<MentionsLegales />} />
                <Route path="/confidentialite" element={<Confidentialite />} />
                <Route path="/cookies" element={<Cookies />} />
                <Route path="/conditions-generales" element={<ConditionsGenerales />} />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/assistance"
                  element={
                    <AdminRoute ecran="/admin/assistance">
                      <AdminAssistance />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/devis"
                  element={
                    <AdminRoute ecran="/admin/devis">
                      <AdminDevisGestion />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/cj-dropshipping"
                  element={
                    <AdminRoute ecran="/admin/cj-dropshipping">
                      <CjDropshippingImport />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/fournisseurs"
                  element={
                    <AdminRoute ecran="/admin/fournisseurs">
                      <Fournisseurs />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/prospection"
                  element={
                    <AdminRoute ecran="/admin/prospection">
                      <ProspectionFournisseurs />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/comptabilite"
                  element={
                    <AdminRoute ecran="/admin/comptabilite">
                      <Comptabilite />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/qualite-fournisseurs"
                  element={
                    <AdminRoute ecran="/admin/qualite-fournisseurs">
                      <QualiteFournisseurs />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/commandes"
                  element={
                    <AdminRoute ecran="/admin/commandes">
                      <AdminCommandesGP />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/vendeurs"
                  element={
                    <AdminRoute ecran="/admin/vendeurs">
                      <AdminVendeursGestion />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/achats-groupes"
                  element={
                    <AdminRoute ecran="/admin/achats-groupes">
                      <AdminAchatsGroupesGestion />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/sourcing"
                  element={
                    <AdminRoute ecran="/admin/sourcing">
                      <AdminSourcingGestion />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/dossiers"
                  element={
                    <AdminRoute ecran="/admin/dossiers">
                      <AdminDossiersGestion />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/produits"
                  element={
                    <AdminRoute ecran="/admin/produits">
                      <AdminProduitsGestion />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/declarant"
                  element={
                    <AdminRoute ecran="/admin/declarant">
                      <AdminDeclarantGestion />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/import"
                  element={
                    <AdminRoute ecran="/admin/import">
                      <AdminImportGestion />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/export"
                  element={
                    <AdminRoute ecran="/admin/export">
                      <AdminExportGestion />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/equipe"
                  element={
                    <AdminRoute ecran="/admin/equipe">
                      <AdminEquipeGestion />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/parametres"
                  element={
                    <AdminRoute ecran="/admin/parametres">
                      <AdminParametres />
                    </AdminRoute>
                  }
                />
                {/* Toute adresse inconnue aboutit ici plutôt qu'à une page blanche. */}
                <Route path="*" element={<PageIntrouvable />} />
              </Routes>
              </Suspense>
              </TransitionDePage>
              {/* Le Déclarant suit l'utilisateur sur tous les écrans : il est
                  dans le routeur pour connaître la page d'où l'on parle. */}
              <AssistantDeclarant />
              {/* Dans le routeur : le bandeau porte un lien vers /cookies. */}
              <BandeauStockage />
            </BrowserRouter>
            <Toaster />
          </CartProvider>
        </CartGPProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
