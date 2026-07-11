Deno.serve(async () => {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return new Response(JSON.stringify({ ok: false, error: "no_key" }), { status: 500 });
  const r = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await r.text();
  return new Response(JSON.stringify({ status: r.status, body: (() => { try { return JSON.parse(body); } catch { return body; } })() }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
