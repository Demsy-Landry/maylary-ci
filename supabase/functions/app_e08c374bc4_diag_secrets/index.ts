// Diagnostic présence-only : confirme que les secrets serveur attendus sont
// bien détectés par les Edge Functions, sans jamais renvoyer leur valeur.
Deno.serve(() => {
  return new Response(JSON.stringify({
    cj_email_set: !!Deno.env.get('CJ_DROPSHIPPING_EMAIL'),
    cj_api_key_set: !!Deno.env.get('CJ_DROPSHIPPING_API_KEY'),
    resend_key_set: !!Deno.env.get('RESEND_API_KEY'),
  }), { headers: { 'Content-Type': 'application/json' } });
});
