// Relais de lecture documentaire — NEUTRALISÉ.
//
// Cette fonction a servi à lire, depuis l'atelier de développement, des textes
// officiels publiés en accès libre par la Direction générale des douanes
// (Code des douanes, partie législative). L'environnement de développement
// n'a pas d'accès sortant vers douanes.ci ; le relais comblait ce manque.
//
// La collecte est terminée. Un relais HTTP ouvert est une surface d'attaque
// gratuite : il est donc fermé plutôt que laissé en place « au cas où ».
// Toute réponse est 410, et l'appel exige désormais un jeton valide.

Deno.serve(() =>
  new Response(
    JSON.stringify({
      erreur: 'Relais neutralisé.',
      detail: "Outil d'atelier temporaire, retiré après la collecte des textes officiels.",
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  )
);
