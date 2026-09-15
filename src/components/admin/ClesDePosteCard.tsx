import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase, PROFILES_TABLE } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KeyRound, Loader2, Copy, Check, Search, Trash2, RotateCcw, ShieldAlert } from 'lucide-react';

/**
 * Les clés de poste, côté maison.
 *
 * La cotation E-Transit tourne sur un poste de bureau : pas d'inscription, pas
 * de session, donc rien à présenter au serveur pour demander une
 * classification. Cette carte fabrique ce qu'elle peut présenter — une clé
 * rattachée à un compte MayLary, plafonnée, révocable.
 *
 * Le point sur lequel tout repose : **la clé est engendrée ici, dans ce
 * navigateur, et la base n'en reçoit que l'empreinte SHA-256**. Elle s'affiche
 * une fois, à cet instant, et nulle part ailleurs ensuite. Ni un serveur, ni
 * une sauvegarde de base, ni un échange de messages ne la portent jamais. Si
 * elle est perdue, on en fabrique une autre et on révoque l'ancienne : c'est
 * l'affaire de dix secondes, et c'est infiniment préférable à une clé qui
 * traînerait quelque part en clair.
 *
 * Le compte choisi compte autant que la clé. C'est son quota qui est consommé,
 * et c'est dans son historique que les recherches atterrissent — ce qui donne
 * la continuité voulue : une position cherchée au Déclarant se retrouve dans
 * E-Transit, et l'inverse.
 */

const TABLE = 'app_e08c374bc4_cles_poste';

interface CleDePoste {
  id: string;
  libelle: string;
  utilisateur_id: string;
  actif: boolean;
  classifications_par_jour: number;
  cree_le: string;
  dernier_usage_le: string | null;
  usages: number;
  note: string | null;
}

interface CompteTrouve {
  user_id: string;
  nom_complet: string | null;
  nom_entreprise: string | null;
}

const nomDe = (c: CompteTrouve) =>
  c.nom_entreprise || c.nom_complet || c.user_id.slice(0, 8) + '…';

const dateCourte = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

/**
 * Une clé lisible à l'œil et sûre au fond : 30 caractères tirés du hasard
 * cryptographique du navigateur, soit largement de quoi rendre toute
 * énumération sans objet. L'alphabet écarte I, O, 0, 1 et U — ce sont les
 * caractères que l'on confond en recopiant, et une clé se recopie parfois.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTVWXYZ23456789';

function engendrerCle(): string {
  const octets = new Uint8Array(30);
  crypto.getRandomValues(octets);
  // Le modulo biaise très légèrement vers le début de l'alphabet (256 n'est pas
  // un multiple de 31). Sur 30 caractères le biais ne retire pas un bit utile
  // à la solidité ; on ne complique pas pour cela.
  const corps = Array.from(octets, (o) => ALPHABET[o % ALPHABET.length]).join('');
  return 'ETR-' + (corps.match(/.{1,6}/g) ?? []).join('-');
}

/** La même empreinte, exactement, que celle calculée côté serveur. */
async function empreinteDe(cle: string): Promise<string> {
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cle));
  return Array.from(new Uint8Array(octets))
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');
}

export default function ClesDePosteCard() {
  const { user } = useAuth();

  const [cles, setCles] = useState<CleDePoste[] | null>(null);
  const [noms, setNoms] = useState<Record<string, string>>({});

  const [libelle, setLibelle] = useState('Cotation E-Transit — poste bureau');
  const [plafond, setPlafond] = useState('20');
  const [note, setNote] = useState('');

  const [recherche, setRecherche] = useState('');
  const [comptes, setComptes] = useState<CompteTrouve[] | null>(null);
  const [porteur, setPorteur] = useState<CompteTrouve | null>(null);

  const [creation, setCreation] = useState(false);
  const [cleEnClair, setCleEnClair] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, libelle, utilisateur_id, actif, classifications_par_jour, cree_le, dernier_usage_le, usages, note')
      .order('cree_le', { ascending: false });
    if (error) {
      toast.error('Les clés de poste ne se chargent pas.', { description: error.message });
      return;
    }
    const lignes = (data as CleDePoste[]) ?? [];
    setCles(lignes);

    const ids = [...new Set(lignes.map((c) => c.utilisateur_id))];
    if (ids.length === 0) return;
    const { data: profils } = await supabase
      .from(PROFILES_TABLE)
      .select('user_id, nom_complet, nom_entreprise')
      .in('user_id', ids);
    setNoms(
      Object.fromEntries(((profils as CompteTrouve[]) ?? []).map((p) => [p.user_id, nomDe(p)])),
    );
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const chercherCompte = async () => {
    const texte = recherche.trim();
    if (texte.length < 2) {
      toast.error('Deux caractères au minimum pour chercher un compte.');
      return;
    }
    const { data, error } = await supabase
      .from(PROFILES_TABLE)
      .select('user_id, nom_complet, nom_entreprise')
      .or(`nom_complet.ilike.%${texte}%,nom_entreprise.ilike.%${texte}%`)
      .limit(20);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComptes((data as CompteTrouve[]) ?? []);
  };

  const creer = async () => {
    const compte = porteur?.user_id ?? user?.id;
    if (!compte) {
      toast.error('Aucun compte porteur : choisissez-en un.');
      return;
    }
    if (!libelle.trim()) {
      toast.error('Donnez un nom à la clé — dans six mois, il dira à quoi elle sert.');
      return;
    }
    const nombre = Number(plafond);
    if (!Number.isFinite(nombre) || nombre < 0 || nombre > 500) {
      toast.error('Le plafond doit être un nombre entre 0 et 500.');
      return;
    }
    if (!crypto?.subtle) {
      toast.error("Ce navigateur n'expose pas de quoi calculer l'empreinte. Ouvrez la page en HTTPS.");
      return;
    }

    setCreation(true);
    const cle = engendrerCle();
    const { error } = await supabase.from(TABLE).insert({
      empreinte: await empreinteDe(cle),
      libelle: libelle.trim(),
      utilisateur_id: compte,
      classifications_par_jour: Math.round(nombre),
      note: note.trim() || null,
    });
    setCreation(false);

    if (error) {
      toast.error("La clé n'a pas été enregistrée.", { description: error.message });
      return;
    }
    // Le seul instant où elle existe en clair quelque part.
    setCleEnClair(cle);
    setCopie(false);
    setNote('');
    void charger();
  };

  const basculer = async (c: CleDePoste) => {
    const { error } = await supabase.from(TABLE).update({ actif: !c.actif }).eq('id', c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(c.actif ? `« ${c.libelle} » est révoquée.` : `« ${c.libelle} » est réactivée.`);
    void charger();
  };

  const supprimer = async (c: CleDePoste) => {
    const { error } = await supabase.from(TABLE).delete().eq('id', c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`« ${c.libelle} » est effacée.`);
    void charger();
  };

  const copier = async () => {
    if (!cleEnClair) return;
    try {
      await navigator.clipboard.writeText(cleEnClair);
      setCopie(true);
      toast.success('Clé copiée. Collez-la maintenant dans E-Transit.');
    } catch {
      toast.error('La copie automatique a échoué — sélectionnez la clé à la main.');
    }
  };

  return (
    <Card className="carte-reactive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          Clés de poste — applications sans compte
        </CardTitle>
        <CardDescription className="leading-relaxed">
          La cotation E-Transit tourne sur un poste de bureau, sans inscription : elle présente une
          clé au lieu d’un compte. La clé est fabriquée <strong>dans ce navigateur</strong> et la
          base n’en garde que l’empreinte — elle s’affiche une seule fois, ici, et ne pourra plus
          jamais être relue. Chaque recherche qu’elle produit consomme le quota du compte porteur et
          entre dans son historique.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* La clé, à l'instant où elle existe. */}
        {cleEnClair && (
          <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-4">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Copiez cette clé maintenant. Elle ne sera plus jamais affichée.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="select-all break-all rounded-lg bg-background px-3 py-2 font-mono text-sm font-bold tracking-tight text-foreground">
                {cleEnClair}
              </code>
              <Button size="sm" variant="outline" className="bouton-anime" onClick={() => void copier()}>
                {copie ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                {copie ? 'Copiée' : 'Copier'}
              </Button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Dans E-Transit : <strong>Réglages → Recherche de position assistée</strong>, collez-la
              dans le champ « Clé de poste ». Elle reste sur cet ordinateur-là. Pour un deuxième
              poste, fabriquez une deuxième clé — on saura ainsi lequel consomme quoi.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-7 px-2 text-xs"
              onClick={() => setCleEnClair(null)}
            >
              J’ai fini, masquer la clé
            </Button>
          </div>
        )}

        {/* Fabriquer. */}
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <Label htmlFor="cle-libelle" className="text-xs">
                À quoi sert cette clé
              </Label>
              <Input
                id="cle-libelle"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder="Cotation E-Transit — poste bureau"
              />
            </div>
            <div>
              <Label htmlFor="cle-plafond" className="text-xs">
                Recherches par jour
              </Label>
              <Input
                id="cle-plafond"
                type="number"
                min={0}
                max={500}
                className="sm:w-32"
                value={plafond}
                onChange={(e) => setPlafond(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="cle-note" className="text-xs">
              À qui elle a été remise
            </Label>
            <Input
              id="cle-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Remise en main propre le 15/09…"
            />
          </div>

          {/* Le compte porteur. Par défaut le vôtre : c'est le cas courant. */}
          <div>
            <Label className="text-xs">Compte porteur du quota et de l’historique</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={porteur ? 'secondary' : 'default'}>
                {porteur ? nomDe(porteur) : 'Mon compte'}
              </Badge>
              {porteur && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setPorteur(null)}>
                  revenir à mon compte
                </Button>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void chercherCompte()}
                placeholder="Chercher un autre compte par nom…"
              />
              <Button variant="outline" size="icon" onClick={() => void chercherCompte()}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {comptes !== null && (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {comptes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun compte à ce nom.</p>
                ) : (
                  comptes.map((c) => (
                    <button
                      key={c.user_id}
                      type="button"
                      className="block w-full rounded-lg border bg-background px-3 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setPorteur(c);
                        setComptes(null);
                        setRecherche('');
                      }}
                    >
                      {nomDe(c)}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <Button className="bouton-anime w-full" disabled={creation} onClick={() => void creer()}>
            {creation ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-1.5 h-4 w-4" />
            )}
            Fabriquer la clé
          </Button>
        </div>

        {/* Ce qui existe déjà. */}
        {cles === null ? (
          <p className="text-sm text-muted-foreground">Lecture des clés…</p>
        ) : cles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune clé pour l’instant. Tant qu’il n’y en a pas, E-Transit cherche les positions par
            mots-clés dans le tarif — ce qui marche, mais sans le raisonnement.
          </p>
        ) : (
          <div className="space-y-2">
            {cles.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{c.libelle}</p>
                    <Badge variant={c.actif ? 'secondary' : 'destructive'} className="text-[10px]">
                      {c.actif ? 'active' : 'révoquée'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {noms[c.utilisateur_id] ?? 'compte inconnu'} · {c.classifications_par_jour}/jour ·{' '}
                    {c.usages} usage{c.usages > 1 ? 's' : ''} · dernier {dateCourte(c.dernier_usage_le)}{' '}
                    · créée le {dateCourte(c.cree_le)}
                    {c.note ? ` · ${c.note}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => void basculer(c)}>
                    {c.actif ? (
                      <>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Révoquer
                      </>
                    ) : (
                      <>
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Réactiver
                      </>
                    )}
                  </Button>
                  {!c.actif && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive"
                      onClick={() => void supprimer(c)}
                    >
                      Effacer
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
