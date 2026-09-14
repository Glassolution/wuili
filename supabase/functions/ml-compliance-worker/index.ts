// Worker da correção em massa de conformidade dos anúncios do Mercado Livre.
// Roda via cron (a cada 5 min) e processa apenas os jobs cujo `scheduled_at`
// já venceu, respeitando o espaçamento entre chamadas ao ML.
// Ordem de prioridade: descrição -> título -> imagem.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { mlFetch } from "../_shared/mlClient.ts";
import { getSellerAccessToken } from "../_shared/mlSellerToken.ts";
import {
  buildSafeDescription,
  filterCleanImages,
  looksLikeMLDom,
  sanitizeTitle,
  stripMLHtml,
} from "../_shared/ml-content-sanitizer.ts";

const KIND_ORDER = ["description", "title", "image"] as const;
const MIN_GAP_MS: Record<string, number> = { description: 4000, title: 8000, image: 16000 };
const MAX_PER_RUN = 12;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Job = {
  id: string;
  kind: string;
  ml_item_id: string;
  seller_id: string;
  attempts: number;
};

async function finish(
  supabase: SupabaseClient,
  job: Job,
  patch: Record<string, unknown>,
) {
  await supabase
    .from("ml_compliance_fixes")
    .update({ processed_at: new Date().toISOString(), ...patch })
    .eq("id", job.id);
}

// Erros permanentes do ML: não adianta tentar de novo.
function isPermanentMLError(status: number, body: string) {
  return status === 400 && (
    /BODY_INVALID_FIELDS/i.test(body) ||
    /cannot modify the title/i.test(body) ||
    /"cause":\s*374/.test(body)
  );
}

async function processJob(supabase: SupabaseClient, job: Job) {
  const tokenRes = await getSellerAccessToken(supabase, job.seller_id);
  if (!tokenRes.ok) {
    // Token do app antigo: só volta a funcionar quando o seller reconectar.
    // Fica registrado à parte, sem re-tentativa em loop.
    return finish(supabase, job, {
      status: "awaiting_reconnect",
      error_message: `aguardando reconexão do seller: ${tokenRes.error}`,
    });
  }
  const auth = { Authorization: `Bearer ${tokenRes.accessToken}` };


  const itemRes = await mlFetch(`https://api.mercadolibre.com/items/${job.ml_item_id}`, { headers: auth });
  const item = await itemRes.json().catch(() => ({}));
  if (!itemRes.ok) {
    return finish(supabase, job, {
      status: "error",
      error_message: `GET /items ${itemRes.status}: ${JSON.stringify(item).slice(0, 300)}`,
    });
  }
  const statusBefore = String(item.status ?? "");
  const reviewBefore = statusBefore === "under_review" ||
    (Array.isArray(item.sub_status) && item.sub_status.some((s: string) => String(s).includes("review")));
  // Anúncios em revisão SÃO alvo da correção (é o que resolve a violação).
  if (!["active", "paused", "under_review"].includes(statusBefore)) {
    return finish(supabase, job, {
      status: "skipped",
      ml_status: statusBefore,
      ml_status_before: statusBefore,
      error_message: "anúncio encerrado/inativo",
    });
  }

  let putRes: Response;
  let afterValue = "";

  if (job.kind === "description") {
    const dRes = await mlFetch(
      `https://api.mercadolibre.com/items/${job.ml_item_id}/description`,
      { headers: auth },
    );
    const current = await dRes.json().catch(() => ({}));
    const raw = String(current?.plain_text ?? current?.text ?? "");
    if (raw && !looksLikeMLDom(raw) && raw === stripMLHtml(raw)) {
      return finish(supabase, job, { status: "skipped", ml_status: item.status, ml_status_before: statusBefore, error_message: "descrição já limpa" });
    }
    afterValue = await buildSafeDescription({
      title: String(item.title ?? ""),
      attributes: item.attributes ?? [],
      rawDescription: raw,
    });
    putRes = await mlFetch(`https://api.mercadolibre.com/items/${job.ml_item_id}/description`, {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ plain_text: afterValue }),
    });
  } else if (job.kind === "title") {
    const brandAttr = (item.attributes ?? []).find((a: { id: string }) => a.id === "BRAND");
    const validatedBrand = brandAttr?.value_name && brandAttr.value_name !== "N/D"
      ? String(brandAttr.value_name)
      : null;
    const san = sanitizeTitle(String(item.title ?? ""), { validatedBrand, maxLength: 60 });
    if (!san.title || san.title === item.title) {
      return finish(supabase, job, { status: "skipped", ml_status: item.status, ml_status_before: statusBefore, error_message: "título já conforme" });
    }
    afterValue = san.title;
    putRes = await mlFetch(`https://api.mercadolibre.com/items/${job.ml_item_id}`, {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ title: afterValue }),
    });
  } else {
    const urls: string[] = (item.pictures ?? [])
      .map((p: { secure_url?: string; url?: string }) => String(p.secure_url ?? p.url ?? ""))
      .filter(Boolean);
    const filtered = await filterCleanImages(urls, { useVision: true, max: 8 });
    if (filtered.rejected.length === 0) {
      return finish(supabase, job, { status: "skipped", ml_status: item.status, ml_status_before: statusBefore, error_message: "imagens já limpas" });
    }
    if (filtered.clean.length === 0) {
      return finish(supabase, job, {
        status: "error",
        ml_status: item.status,
        error_message: "nenhuma imagem limpa disponível — necessita nova foto do produto",
      });
    }
    afterValue = filtered.clean.join("\n");
    putRes = await mlFetch(`https://api.mercadolibre.com/items/${job.ml_item_id}`, {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ pictures: filtered.clean.map((source) => ({ source })) }),
    });
  }

  const putBody = await putRes.text();
  if (!putRes.ok) {
    const permanent = isPermanentMLError(putRes.status, putBody);
    return finish(supabase, job, {
      status: permanent ? "not_applicable" : "error",
      ml_status: item.status,
      ml_status_before: statusBefore,
      error_message: permanent
        ? `regra permanente do ML (não reprocessar) — PUT ${putRes.status}: ${putBody.slice(0, 300)}`
        : `PUT ${putRes.status}: ${putBody.slice(0, 400)}`,
    });
  }


  // Confere se o anúncio entrou em revisão após a alteração
  await sleep(1500);
  const checkRes = await mlFetch(`https://api.mercadolibre.com/items/${job.ml_item_id}?attributes=status,sub_status`, {
    headers: auth,
  });
  const check = await checkRes.json().catch(() => ({}));
  const subStatus: string[] = Array.isArray(check?.sub_status) ? check.sub_status : [];
  // under_review só é sinalizado quando a revisão é NOVA (não existia antes da correção)
  const reviewNow = String(check?.status) === "under_review" ||
    subStatus.some((s) => String(s).includes("review"));
  const underReview = reviewNow && !reviewBefore;

  return finish(supabase, job, {
    status: "success",
    ml_status_before: statusBefore,
    after_value: afterValue.slice(0, 4000),
    ml_status: check?.status ?? item.status,
    under_review: underReview,
    error_message: null,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const body = await req.json().catch(() => ({}));
  const onlyKind = body?.kind ? String(body.kind) : null;
  const maxItems = Math.min(Number(body?.max ?? MAX_PER_RUN), 20);

  const processed: Record<string, unknown>[] = [];

  try {
    for (const kind of KIND_ORDER) {
      if (onlyKind && kind !== onlyKind) continue;
      if (processed.length >= maxItems) break;

      const { data: jobs } = await supabase
        .from("ml_compliance_fixes")
        .select("id, kind, ml_item_id, seller_id, attempts")
        .eq("kind", kind)
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(maxItems - processed.length);

      for (const job of (jobs ?? []) as Job[]) {
        const { data: claimed } = await supabase
          .from("ml_compliance_fixes")
          .update({ status: "processing", attempts: job.attempts + 1 })
          .eq("id", job.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (!claimed) continue;

        try {
          await processJob(supabase, job);
        } catch (err) {
          await finish(supabase, job, { status: "error", error_message: String(err).slice(0, 400) });
        }
        processed.push({ kind, ml_item_id: job.ml_item_id });
        await sleep(MIN_GAP_MS[kind]);
      }
    }

    return json({ processed: processed.length, items: processed });
  } catch (err) {
    console.error("[ml-compliance-worker]", err);
    return json({ error: String(err) }, 500);
  }
});
