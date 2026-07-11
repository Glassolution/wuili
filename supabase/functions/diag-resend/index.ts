Deno.serve(async (req) => {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return new Response(JSON.stringify({ ok: false, error: "no_key" }), { status: 500 });
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ?? "delivered@resend.dev";
  const from = url.searchParams.get("from") ?? "Velo <noreply@velods.com.br>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: "diag", html: "<p>diag</p>" }),
  });
  const body = await r.text();
  return new Response(JSON.stringify({ status: r.status, from, to, body: (() => { try { return JSON.parse(body); } catch { return body; } })() }), {
    headers: { "Content-Type": "application/json" },
  });
});
