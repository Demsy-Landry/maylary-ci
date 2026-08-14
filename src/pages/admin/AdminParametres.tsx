import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  supabase,
  PARAMETRES_FACTURATION_TABLE,
  type ParametresFacturation,
} from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AdminNav from '@/components/AdminNav';
import CanauxPaiementCard from '@/components/admin/CanauxPaiementCard';
import ConsigneDeclarantCard from '@/components/admin/ConsigneDeclarantCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, KeyRound, ReceiptText } from 'lucide-react';

export default function AdminParametres() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Tous les champs sont obligatoires.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    if (!user?.email) {
      setError('Session invalide, reconnectez-vous.');
      return;
    }

    setLoading(true);

    // Re-vérifie le mot de passe actuel avant tout changement (une session
    // active ne suffit pas à prouver que l'utilisateur connaît toujours son
    // mot de passe — utile si l'onglet est resté ouvert longtemps).
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reauthError) {
      setError('Mot de passe actuel incorrect.');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError("Impossible de changer le mot de passe. Réessayez.");
      setLoading(false);
      return;
    }

    toast.success('Mot de passe changé avec succès.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-screen-xl px-4 py-4 sm:px-6">
          <div className="space-y-2">
            <AdminNav />
            <h1 className="font-display text-lg font-bold text-foreground">Admin — Paramètres</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-md space-y-6 px-4 py-8 sm:px-6">
        {/* En tête : sans canal d'encaissement, la boutique prend des commandes
            qu'elle ne peut pas faire payer. Rien n'est plus urgent sur cet écran. */}
        <CanauxPaiementCard />

        <ParametresFacturationCard />

        <ConsigneDeclarantCard />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle>Changer mon mot de passe</CardTitle>
            </div>
            <CardDescription>Connecté en tant que {user?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Mot de passe actuel</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="8 caractères minimum"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Changer le mot de passe
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

/**
 * Identité de l'entreprise telle qu'elle apparaît sur les factures et
 * proformas. Chaque document émis en garde une copie figée : modifier ces
 * champs n'altère jamais une facture déjà envoyée à un client.
 */
function ParametresFacturationCard() {
  const [parametres, setParametres] = useState<ParametresFacturation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const charger = async () => {
    const { data } = await supabase
      .from(PARAMETRES_FACTURATION_TABLE)
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    setParametres((data as ParametresFacturation) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    charger();
  }, []);

  const champ = <K extends keyof ParametresFacturation>(cle: K, valeur: ParametresFacturation[K]) =>
    setParametres((prev) => (prev ? { ...prev, [cle]: valeur } : prev));

  const enregistrer = async () => {
    if (!parametres) return;
    setSaving(true);
    const { error } = await supabase
      .from(PARAMETRES_FACTURATION_TABLE)
      .update({
        raison_sociale: parametres.raison_sociale,
        nom_commercial: parametres.nom_commercial,
        adresse: parametres.adresse,
        ville: parametres.ville,
        pays: parametres.pays,
        telephone: parametres.telephone,
        email: parametres.email,
        rccm: parametres.rccm,
        ncc: parametres.ncc,
        assujetti_tva: parametres.assujetti_tva,
        taux_tva: parametres.taux_tva,
        conditions_paiement: parametres.conditions_paiement,
        coordonnees_paiement: parametres.coordonnees_paiement,
        mentions_bas_page: parametres.mentions_bas_page,
        validite_proforma_jours: parametres.validite_proforma_jours,
      })
      .eq('id', 1);
    setSaving(false);

    if (error) {
      toast.error("Impossible d'enregistrer les réglages de facturation.");
      return;
    }
    toast.success('Réglages de facturation enregistrés.');
    charger();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Chargement des réglages de facturation…
        </CardContent>
      </Card>
    );
  }

  if (!parametres) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Réglages de facturation indisponibles.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-primary" />
          <CardTitle>Facturation — identité de l'entreprise</CardTitle>
        </div>
        <CardDescription>
          Ces informations composent l'en-tête et le pied de page de vos factures et proformas. Les
          documents déjà émis conservent l'identité en vigueur au moment de leur émission.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="cascade grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="raison-sociale">Raison sociale</Label>
            <Input
              id="raison-sociale"
              value={parametres.raison_sociale}
              onChange={(e) => champ('raison_sociale', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nom-commercial">Nom commercial</Label>
            <Input
              id="nom-commercial"
              value={parametres.nom_commercial}
              onChange={(e) => champ('nom_commercial', e.target.value)}
            />
          </div>
        </div>

        <div className="cascade grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="adresse-facture">Adresse</Label>
            <Input
              id="adresse-facture"
              value={parametres.adresse ?? ''}
              onChange={(e) => champ('adresse', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ville-facture">Ville</Label>
            <Input
              id="ville-facture"
              value={parametres.ville}
              onChange={(e) => champ('ville', e.target.value)}
            />
          </div>
        </div>

        <div className="cascade grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tel-facture">Téléphone</Label>
            <Input
              id="tel-facture"
              value={parametres.telephone ?? ''}
              onChange={(e) => champ('telephone', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-facture">Email</Label>
            <Input
              id="email-facture"
              value={parametres.email ?? ''}
              onChange={(e) => champ('email', e.target.value)}
            />
          </div>
        </div>

        <div className="cascade grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rccm">RCCM</Label>
            <Input
              id="rccm"
              value={parametres.rccm ?? ''}
              onChange={(e) => champ('rccm', e.target.value)}
              placeholder="À renseigner après immatriculation"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ncc">NCC (compte contribuable)</Label>
            <Input
              id="ncc"
              value={parametres.ncc ?? ''}
              onChange={(e) => champ('ncc', e.target.value)}
              placeholder="À renseigner après immatriculation"
            />
          </div>
        </div>

        <div className="rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={parametres.assujetti_tva}
              onChange={(e) => champ('assujetti_tva', e.target.checked)}
              className="h-4 w-4"
            />
            Entreprise assujettie à la TVA
          </label>
          {parametres.assujetti_tva ? (
            <div className="mt-3 max-w-xs space-y-1.5">
              <Label htmlFor="taux-tva">Taux de TVA (%)</Label>
              <Input
                id="taux-tva"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={Math.round(Number(parametres.taux_tva) * 1000) / 10}
                onChange={(e) => champ('taux_tva', (parseFloat(e.target.value) || 0) / 100)}
              />
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Les factures seront émises hors TVA, sans ligne de taxe. Activez cette option une fois
              votre entreprise immatriculée et assujettie.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="conditions">Conditions de règlement</Label>
          <Textarea
            id="conditions"
            rows={2}
            value={parametres.conditions_paiement ?? ''}
            onChange={(e) => champ('conditions_paiement', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="coordonnees">Coordonnées de paiement</Label>
          <Textarea
            id="coordonnees"
            rows={2}
            value={parametres.coordonnees_paiement ?? ''}
            onChange={(e) => champ('coordonnees_paiement', e.target.value)}
            placeholder="Mobile Money, IBAN, titulaire du compte…"
          />
        </div>

        <div className="cascade grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mentions">Mentions de bas de page</Label>
            <Input
              id="mentions"
              value={parametres.mentions_bas_page ?? ''}
              onChange={(e) => champ('mentions_bas_page', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="validite">Validité proforma (jours)</Label>
            <Input
              id="validite"
              type="number"
              min={1}
              value={parametres.validite_proforma_jours}
              onChange={(e) => champ('validite_proforma_jours', parseInt(e.target.value, 10) || 15)}
            />
          </div>
        </div>

        <Button onClick={enregistrer} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer les réglages de facturation
        </Button>
      </CardContent>
    </Card>
  );
}
