import { useEffect } from 'react';
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
import CatalogueCategorieGP from '@/pages/CatalogueCategorieGP';
import ProduitDetailGP from '@/pages/ProduitDetailGP';
import PanierAchat from '@/pages/PanierAchat';
import CommandeGP from '@/pages/CommandeGP';
import CompteGP from '@/pages/CompteGP';
import MesCommandesGP from '@/pages/MesCommandesGP';
import AchatsGroupes from '@/pages/AchatsGroupes';
import Declarant from '@/pages/Declarant';
import PoidsTaxable from '@/pages/PoidsTaxable';
import SourcingGP from '@/pages/SourcingGP';
import EspaceVendeur from '@/pages/EspaceVendeur';
import CataloguePro from '@/pages/CataloguePro';
import CatalogueSecteurPro from '@/pages/CatalogueSecteurPro';
import ProduitDetailPro from '@/pages/ProduitDetailPro';
import PanierDevis from '@/pages/PanierDevis';
import MesDevis from '@/pages/MesDevis';
import CjDropshippingImport from '@/pages/admin/CjDropshippingImport';
import ProspectionFournisseurs from '@/pages/admin/ProspectionFournisseurs';
import Fournisseurs from '@/pages/admin/Fournisseurs';
import QualiteFournisseurs from '@/pages/admin/QualiteFournisseurs';
import Comptabilite from '@/pages/admin/Comptabilite';
import AdminCommandesGP from '@/pages/admin/CommandesGP';
import AdminSourcingGestion from '@/pages/admin/SourcingGestion';
import AdminVendeursGestion from '@/pages/admin/VendeursGestion';
import AdminAchatsGroupesGestion from '@/pages/admin/AchatsGroupesGestion';
import AdminEquipeGestion from '@/pages/admin/EquipeGestion';
import AdminDevisGestion from '@/pages/admin/DevisGestion';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminAssistance from '@/pages/admin/Assistance';
import AdminImportGestion from '@/pages/admin/ImportGestion';
import NouvelleDemandeImport from '@/pages/NouvelleDemandeImport';
import MesDemandesImport from '@/pages/MesDemandesImport';
import AdminExportGestion from '@/pages/admin/ExportGestion';
import NouvelleDemandeExport from '@/pages/NouvelleDemandeExport';
import MesDemandesExport from '@/pages/MesDemandesExport';
import AdminLogin from '@/pages/admin/AdminLogin';
import APropos from '@/pages/APropos';
import MentionsLegales from '@/pages/MentionsLegales';
import Confidentialite from '@/pages/Confidentialite';
import PageIntrouvable from '@/pages/PageIntrouvable';
import TransitionDePage from '@/components/TransitionDePage';
import AssistantDeclarant from '@/components/AssistantDeclarant';
import { demarrerRevelation } from '@/lib/revelation';
import AdminParametres from '@/pages/admin/AdminParametres';
import MonCompte from '@/pages/MonCompte';

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
                <Route path="/declarant" element={<Declarant />} />
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
                <Route path="/a-propos" element={<APropos />} />
                <Route path="/mentions-legales" element={<MentionsLegales />} />
                <Route path="/confidentialite" element={<Confidentialite />} />
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
              </TransitionDePage>
              {/* Le Déclarant suit l'utilisateur sur tous les écrans : il est
                  dans le routeur pour connaître la page d'où l'on parle. */}
              <AssistantDeclarant />
            </BrowserRouter>
            <Toaster />
          </CartProvider>
        </CartGPProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
