import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { CartGPProvider } from '@/hooks/useCartGP';
import { CartProvider } from '@/hooks/useCart';
import AdminRoute from '@/components/AdminRoute';
import Index from '@/pages/Index';
import CatalogueGrandPublic from '@/pages/CatalogueGrandPublic';
import CatalogueCategorieGP from '@/pages/CatalogueCategorieGP';
import ProduitDetailGP from '@/pages/ProduitDetailGP';
import PanierAchat from '@/pages/PanierAchat';
import CommandeGP from '@/pages/CommandeGP';
import CompteGP from '@/pages/CompteGP';
import MesCommandesGP from '@/pages/MesCommandesGP';
import CataloguePro from '@/pages/CataloguePro';
import CatalogueSecteurPro from '@/pages/CatalogueSecteurPro';
import ProduitDetailPro from '@/pages/ProduitDetailPro';
import PanierDevis from '@/pages/PanierDevis';
import MesDevis from '@/pages/MesDevis';
import CjDropshippingImport from '@/pages/admin/CjDropshippingImport';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartGPProvider>
          <CartProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/boutique" element={<CatalogueGrandPublic />} />
                <Route path="/boutique/categorie/:categorieId" element={<CatalogueCategorieGP />} />
                <Route path="/boutique/produit/:produitId" element={<ProduitDetailGP />} />
                <Route path="/boutique/panier" element={<PanierAchat />} />
                <Route path="/boutique/commande" element={<CommandeGP />} />
                <Route path="/boutique/compte" element={<CompteGP />} />
                <Route path="/boutique/mes-commandes" element={<MesCommandesGP />} />
                <Route path="/catalogue" element={<CataloguePro />} />
                <Route path="/catalogue/secteur/:secteurId" element={<CatalogueSecteurPro />} />
                <Route path="/catalogue/produit/:produitId" element={<ProduitDetailPro />} />
                <Route path="/catalogue/devis" element={<PanierDevis />} />
                <Route path="/catalogue/mes-devis" element={<MesDevis />} />
                <Route
                  path="/admin/cj-dropshipping"
                  element={
                    <AdminRoute>
                      <CjDropshippingImport />
                    </AdminRoute>
                  }
                />
              </Routes>
            </BrowserRouter>
            <Toaster />
          </CartProvider>
        </CartGPProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
