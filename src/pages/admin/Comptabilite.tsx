import { useEffect, useMemo, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import {
  supabase,
  GRAND_LIVRE_VIEW,
  BALANCE_VIEW,
  COMPTE_RESULTAT_VIEW,
  JOURNAUX_LABELS,
  type LigneGrandLivre,
  type LigneBalance,
  type LigneCompteResultat,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Download, Scale, TrendingUp, TriangleAlert } from 'lucide-react';

type Onglet = 'journal' | 'balance' | 'resultat';

const fcfa = (n: number) => Math.round(n).toLocaleString('fr-FR');

/** Premier jour de l'année en cours, borne par défaut de l'exercice. */
const debutExercice = () => `${new Date().getFullYear()}-01-01`;
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Les comptes de MayLary Group.
 *
 * Trois lectures d'un même journal : les écritures dans l'ordre où elles se
 * sont produites, la balance qui les totalise par compte, et le compte de
 * résultat qui dit ce que l'exercice a gagné ou perdu.
 *
 * La balance affiche son écart débit-crédit en tête. Il vaut zéro tant que la
 * base tient sa règle d'équilibre — l'afficher quand même est ce qui permet de
 * s'en apercevoir le jour où ce ne serait plus vrai.
 */
export default function Comptabilite() {
  const [onglet, setOnglet] = useState<Onglet>('journal');
  const [du, setDu] = useState(debutExercice);
  const [au, setAu] = useState(aujourdhui);

  const [journal, setJournal] = useState<LigneGrandLivre[]>([]);
  const [balance, setBalance] = useState<LigneBalance[]>([]);
  const [resultat, setResultat] = useState<LigneCompteResultat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      setLoading(true);
      const [j, b, r] = await Promise.all([
        supabase
          .from(GRAND_LIVRE_VIEW)
          .select('*')
          .gte('date_ecriture', du)
          .lte('date_ecriture', au)
          .order('date_ecriture', { ascending: false })
          .order('numero', { ascending: false })
          .order('ordre'),
        supabase.from(BALANCE_VIEW).select('*').order('code'),
        supabase.from(COMPTE_RESULTAT_VIEW).select('*').order('classe').order('code'),
      ]);
      setJournal((j.data as LigneGrandLivre[]) ?? []);
      setBalance((b.data as LigneBalance[]) ?? []);
      setResultat((r.data as LigneCompteResultat[]) ?? []);
      setLoading(false);
    };
    charger();
  }, [du, au]);

  const totaux = useMemo(() => {
    const debit = balance.reduce((s, l) => s + Number(l.total_debit), 0);
    const credit = balance.reduce((s, l) => s + Number(l.total_credit), 0);
    const produits = resultat
      .filter((l) => l.classe === 7)
      .reduce((s, l) => s + Number(l.montant), 0);
    const charges = resultat
      .filter((l) => l.classe === 6)
      .reduce((s, l) => s + Number(l.montant), 0);
    // Trésorerie : ce qui reste réellement en banque et en monnaie électronique.
    const tresorerie = balance
      .filter((l) => l.code.startsWith('5'))
      .reduce((s, l) => s + Number(l.solde), 0);
    return { debit, credit, ecart: debit - credit, produits, charges, resultat: produits - charges, tresorerie };
  }, [balance, resultat]);

  /**
   * Export pour le comptable. Le point-virgule et le BOM ne sont pas des
   * détails : sans eux, Excel en configuration française ouvre le fichier en
   * une seule colonne et massacre les accents.
   */
  const exporter = () => {
    const entetes = ['Date', 'Numero', 'Journal', 'Piece', 'Compte', 'Libelle compte', 'Libelle', 'Debit', 'Credit'];
    const lignes = journal.map((l) =>
      [
        l.date_ecriture,
        l.numero,
        l.journal,
        l.piece ?? '',
        l.compte,
        l.compte_libelle,
        l.ligne_libelle ?? l.ecriture_libelle,
        Math.round(Number(l.debit_fcfa)) || '',
        Math.round(Number(l.credit_fcfa)) || '',
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    );
    const contenu = '﻿' + [entetes.join(';'), ...lignes].join('\r\n');
    const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `maylary-journal-${du}-au-${au}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6">
        <AdminNav />

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Comptabilité</h1>
            <p className="text-sm text-muted-foreground">
              Journal en partie double, tenu dans la logique des classes SYSCOHADA.
            </p>
          </div>
          <Button variant="outline" onClick={exporter} disabled={journal.length === 0}>
            <Download className="mr-1.5 h-4 w-4" />
            Exporter le journal
          </Button>
        </div>

        {/* Le plan de comptes engage un dépôt d'états financiers : le dire ici,
            pas dans une note de bas de page que personne ne lit. */}
        <div className="mt-4 flex gap-2 rounded-md border bg-muted/40 p-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            L'imputation de certains postes — droits de douane, frais accessoires d'achat — admet
            plusieurs lectures. Faites valider ce plan de comptes par un expert-comptable avant tout
            dépôt d'états financiers. Le mécanisme d'équilibre, lui, est vérifié par la base à
            chaque écriture.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Produits', valeur: fcfa(totaux.produits), icone: TrendingUp },
            { label: 'Charges', valeur: fcfa(totaux.charges), icone: TrendingUp },
            {
              label: 'Résultat',
              valeur: fcfa(totaux.resultat),
              icone: TrendingUp,
              accent: totaux.resultat < 0,
            },
            { label: 'Trésorerie', valeur: fcfa(totaux.tresorerie), icone: Scale },
          ].map((c) => (
            <div key={c.label} className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p
                className={`text-lg font-semibold ${c.accent ? 'text-destructive' : 'text-foreground'}`}
              >
                {c.valeur} FCFA
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="du">Du</Label>
            <Input id="du" type="date" value={du} onChange={(e) => setDu(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="au">Au</Label>
            <Input id="au" type="date" value={au} onChange={(e) => setAu(e.target.value)} />
          </div>
        </div>

        <Tabs value={onglet} onValueChange={(v) => setOnglet(v as Onglet)} className="mt-5">
          <TabsList>
            <TabsTrigger value="journal">
              <BookOpen className="mr-1.5 h-4 w-4" />
              Journal
            </TabsTrigger>
            <TabsTrigger value="balance">
              <Scale className="mr-1.5 h-4 w-4" />
              Balance
            </TabsTrigger>
            <TabsTrigger value="resultat">
              <TrendingUp className="mr-1.5 h-4 w-4" />
              Résultat
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="journal" className="mt-4">
                {journal.length === 0 ? (
                  <p className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                    Aucune écriture sur cette période. Les ventes se comptabilisent à la
                    confirmation du règlement, depuis l'écran Commandes.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[52rem] text-sm">
                      <thead className="bg-muted/50 text-left text-xs font-medium text-foreground">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Écriture</th>
                          <th className="px-3 py-2">Journal</th>
                          <th className="px-3 py-2">Compte</th>
                          <th className="px-3 py-2">Libellé</th>
                          <th className="px-3 py-2 text-right">Débit</th>
                          <th className="px-3 py-2 text-right">Crédit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {journal.map((l) => (
                          <tr key={l.id}>
                            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                              {new Date(l.date_ecriture).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                              {l.numero}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline">{JOURNAUX_LABELS[l.journal] ?? l.journal}</Badge>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <span className="font-medium text-foreground">{l.compte}</span>{' '}
                              <span className="text-xs text-muted-foreground">
                                {l.compte_libelle}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {l.ligne_libelle ?? l.ecriture_libelle}
                              {l.piece && (
                                <span className="block text-xs">Pièce : {l.piece}</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                              {Number(l.debit_fcfa) > 0 ? fcfa(Number(l.debit_fcfa)) : ''}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                              {Number(l.credit_fcfa) > 0 ? fcfa(Number(l.credit_fcfa)) : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="balance" className="mt-4">
                {/* L'écart doit valoir zéro. Il est affiché précisément pour
                    qu'on s'aperçoive du jour où il ne le vaudrait plus. */}
                <p
                  className={`mb-3 text-sm ${totaux.ecart === 0 ? 'text-muted-foreground' : 'font-semibold text-destructive'}`}
                >
                  Total débit {fcfa(totaux.debit)} · total crédit {fcfa(totaux.credit)} · écart{' '}
                  {fcfa(totaux.ecart)} FCFA
                  {totaux.ecart === 0 ? ' — la balance est juste.' : ' — anomalie à examiner.'}
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead className="bg-muted/50 text-left text-xs font-medium text-foreground">
                      <tr>
                        <th className="px-3 py-2">Compte</th>
                        <th className="px-3 py-2 text-right">Débit</th>
                        <th className="px-3 py-2 text-right">Crédit</th>
                        <th className="px-3 py-2 text-right">Solde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {balance.map((l) => (
                        <tr key={l.code}>
                          <td className="px-3 py-2">
                            <span className="font-medium text-foreground">{l.code}</span>{' '}
                            <span className="text-muted-foreground">{l.libelle}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {fcfa(Number(l.total_debit))}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {fcfa(Number(l.total_credit))}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                            {fcfa(Number(l.solde))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="resultat" className="mt-4">
                <div className="space-y-4">
                  {(['Produits', 'Charges'] as const).map((nature) => {
                    const lignes = resultat.filter((l) => l.nature === nature);
                    if (lignes.length === 0) return null;
                    const total = lignes.reduce((s, l) => s + Number(l.montant), 0);
                    return (
                      <div key={nature} className="overflow-hidden rounded-md border">
                        <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
                          <span>{nature}</span>
                          <span>{fcfa(total)} FCFA</span>
                        </div>
                        {lignes.map((l) => (
                          <div
                            key={l.code}
                            className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 text-muted-foreground">
                              <span className="font-medium text-foreground">{l.code}</span>{' '}
                              {l.libelle}
                            </span>
                            <span className="shrink-0">{fcfa(Number(l.montant))} FCFA</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-3">
                    <span className="font-semibold text-foreground">
                      Résultat {totaux.resultat < 0 ? '(perte)' : '(bénéfice)'}
                    </span>
                    <span
                      className={`text-lg font-bold ${totaux.resultat < 0 ? 'text-destructive' : 'text-primary'}`}
                    >
                      {fcfa(totaux.resultat)} FCFA
                    </span>
                  </div>
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
