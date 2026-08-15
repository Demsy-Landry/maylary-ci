import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShieldCheck, Download, Loader2, UserX, AlertTriangle } from 'lucide-react';

/**
 * Vos droits, exerçables sans écrire à personne.
 *
 * La politique de confidentialité annonce le droit d'accès et le droit
 * d'effacement, puis renvoie à une adresse e-mail. Ce n'est pas faux, mais ça
 * repose sur quelqu'un qui répond sous trente jours, à la main, pour chaque
 * demande. Le système sait le faire lui-même.
 *
 * SUR LA FERMETURE DE COMPTE, LE TEXTE NE PROMET PAS PLUS QUE CE QUI EST FAIT
 *
 * Un bouton « supprimer mon compte » qui laisserait en base les commandes et
 * les factures serait un mensonge. Un bouton qui les supprimerait vraiment
 * serait une faute : une facture émise ne s'efface pas parce que son
 * destinataire ferme son compte.
 *
 * L'écran dit donc exactement ce qui se passe — ce qui est effacé tout de
 * suite, ce qui est conservé, et pourquoi — et le confirme avec le compte des
 * pièces réellement gardées. Le client décide en connaissance de cause.
 *
 * La confirmation par saisie du mot FERMER n'est pas une coquetterie : c'est
 * une action sans retour, et un clic malheureux sur téléphone est vite arrivé.
 */
export default function MesDonneesPersonnelles({ email }: { email: string }) {
  const navigate = useNavigate();
  const [export_, setExport] = useState(false);
  const [ouvertFermeture, setOuvertFermeture] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [motif, setMotif] = useState('');
  const [fermeture, setFermeture] = useState(false);

  const exporter = async () => {
    setExport(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_exporter_mes_donnees');
    setExport(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Le fichier est fabriqué dans le navigateur : les données ne repassent
    // par aucun serveur intermédiaire pour être mises en forme.
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `maylary-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
    lien.click();
    URL.revokeObjectURL(url);
    toast.success('Vos données ont été téléchargées.');
  };

  const fermer = async () => {
    if (confirmation.trim().toUpperCase() !== 'FERMER') {
      toast.error('Saisissez FERMER pour confirmer.');
      return;
    }
    setFermeture(true);
    const { data, error } = await supabase.rpc('app_e08c374bc4_fermer_mon_compte', {
      p_motif: motif || null,
    });
    if (error) {
      setFermeture(false);
      toast.error(error.message);
      return;
    }
    const pieces = (data as { pieces_conservees?: number } | null)?.pieces_conservees ?? 0;
    await supabase.auth.signOut();
    setFermeture(false);
    toast.success(
      pieces > 0
        ? `Compte fermé. ${pieces} pièce${pieces > 1 ? 's' : ''} comptable${pieces > 1 ? 's' : ''} conservée${pieces > 1 ? 's' : ''}, sans lien avec votre identité.`
        : 'Compte fermé. Vos données d’identification ont été effacées.',
    );
    navigate('/');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Mes données personnelles</CardTitle>
        </div>
        <CardDescription>
          La loi n° 2013-450 vous donne le droit d’accéder à vos données et d’en demander
          l’effacement. Vous les exercez ici, sans nous écrire.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Droit d'accès. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Emporter mes données</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              Un fichier avec tout ce que nous détenons sur vous : profil, commandes, demandes
              d’import et d’export, classifications et liquidations.
            </p>
          </div>
          <Button variant="outline" className="bouton-anime shrink-0" onClick={() => void exporter()} disabled={export_}>
            {export_ ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Télécharger
          </Button>
        </div>

        {/* Droit à l'effacement. */}
        <div className="rounded-lg border border-destructive/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Fermer mon compte</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                Efface immédiatement votre nom, votre téléphone, votre ville et votre adresse.
                Le compte <span className="break-all">{email}</span> ne pourra plus servir.
              </p>
            </div>
            {!ouvertFermeture && (
              <Button
                variant="outline"
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/5"
                onClick={() => setOuvertFermeture(true)}
              >
                <UserX className="mr-1.5 h-4 w-4" />
                Fermer
              </Button>
            )}
          </div>

          {ouvertFermeture && (
            <div className="rideau mt-4 space-y-4 border-t pt-4">
              <div className="flex items-start gap-3 rounded-md bg-muted/40 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="text-sm leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-foreground">Ce qui est conservé, et pourquoi</p>
                  <p className="mt-1">
                    Vos commandes et les factures déjà émises restent en base : une facture ne
                    s’efface pas parce que son destinataire ferme son compte, l’obligation
                    comptable l’exige. Elles ne seront plus rattachables à votre identité depuis
                    l’application.
                  </p>
                  <p className="mt-1.5">
                    Pour la suppression complète de votre identifiant de connexion, votre demande
                    est enregistrée et traitée manuellement, après vérification qu’aucune opération
                    en cours ne s’y oppose.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motif-fermeture">Pourquoi partez-vous ? (facultatif)</Label>
                <Input
                  id="motif-fermeture"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Cela nous aide à corriger ce qui doit l’être"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmation-fermeture">
                  Saisissez <strong className="text-foreground">FERMER</strong> pour confirmer
                </Label>
                <Input
                  id="confirmation-fermeture"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  onClick={() => void fermer()}
                  disabled={fermeture || confirmation.trim().toUpperCase() !== 'FERMER'}
                >
                  {fermeture && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Fermer définitivement mon compte
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOuvertFermeture(false);
                    setConfirmation('');
                  }}
                >
                  Annuler
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Pensez à <button type="button" onClick={() => void exporter()} className="font-medium text-primary hover:underline">
                  emporter vos données
                </button>{' '}
                avant : après fermeture, l’export n’est plus possible.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Le détail des traitements figure dans{' '}
          <Link to="/confidentialite" className="text-primary hover:underline">
            la politique de confidentialité
          </Link>
          . Si notre réponse ne vous satisfait pas, vous pouvez saisir l’ARTCI.
        </p>
      </CardContent>
    </Card>
  );
}
