// Checkout público das páginas de vendas geradas pelos usuários.
// Gateway: ValidaPay (Pix). A integração antiga com o Mercado Pago foi
// descontinuada junto com as assinaturas — o token da conta MP não é mais
// válido e devolvia 401 "invalid access token", causando o 400 no "Pagar agora".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { validaPayFetch, ValidaPayError } from "../_shared/validapay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  slug: string;
  payment_method: "pix" | "credit_card";
  buyer: {
    name: string;
    email: string;
    phone?: string;
    cpf?: string;
  };
  shipping?: Record<string, string | undefined>;
  quantity?: number;
  /** Gorjeta escolhida no carrinho (R$). Taxa de serviço e impostos são fixos. */
  tip?: number;
};

// Espelha src/pages/public-sales/cartTotals.ts — o "Total a pagar" do carrinho
// é subtotal + taxa de serviço + impostos + gorjeta.
const SERVICE_FEE_BRL = 1.5;
const TAX_BRL = 3.5;
const MAX_TIP_BRL = 500;
const sanitizeTip = (value: unknown): number => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Number(Math.min(MAX_TIP_BRL, n).toFixed(2));
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Lê "R$ 1.299,90" em pt-BR (ponto = milhar, vírgula = decimal). */
const parsePriceBRL = (text: string): number | null => {
  const match = text.match(/(\d[\d.]*(?:,\d{1,2})?)/);
  if (!match) return null;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
};

/** Mesma prioridade de resolveProjectPrice no frontend. */
const resolveEditedPrice = (metadata: {
  price?: number | string;
  elementOverrides?: Record<string, { textContent?: string }>;
}): number | null => {
  const raw = metadata.price;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const parsed = parsePriceBRL(raw);
    if (parsed !== null) return parsed;
  }
  const found: number[] = [];
  for (const override of Object.values(metadata.elementOverrides ?? {})) {
    const text = override?.textContent;
    if (typeof text !== "string" || !/R\$/i.test(text)) continue;
    const parsed = parsePriceBRL(text);
    if (parsed !== null) found.push(parsed);
  }
  return found.length ? Math.min(...found) : null;
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const dbUrl = Deno.env.get("DB_URL") ?? Deno.env.get("SUPABASE_URL")!;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(dbUrl, dbKey);

    const body = (await req.json()) as Body;

    if (!body?.slug || !body?.buyer?.name || !body?.buyer?.email) {
      return json({ error: "Preencha nome, e-mail e tente novamente." }, 400);
    }

    const cpf = (body.buyer.cpf ?? "").replace(/\D/g, "");
    if (cpf.length !== 11 && cpf.length !== 14) {
      return json({ error: "Informe um CPF válido para gerar o Pix." }, 400);
    }

    // 1) Resolver a página de vendas via slug (generated_sales_pages ou user_projects).
    let ownerId: string | null = null;
    let salesPageId: string | null = null;
    let projectId: string | null = null;
    let catalogProductId: string | null = null;
    let productTitle = "Produto";
    let productImage: string | null = null;
    let unitPrice = 0;

    const { data: gsp } = await admin
      .from("generated_sales_pages")
      .select("id,user_id,catalog_product_id,product_title,hero_image_url,price_brl")
      .eq("slug", body.slug)
      .maybeSingle();

    if (gsp) {
      ownerId = gsp.user_id;
      salesPageId = gsp.id;
      catalogProductId = gsp.catalog_product_id ?? null;
      productTitle = gsp.product_title || productTitle;
      productImage = gsp.hero_image_url ?? null;
      unitPrice = Number(gsp.price_brl ?? 0);
    } else {
      const { data: project } = await admin
        .from("user_projects")
        .select("id,user_id,metadata,nome")
        .eq("status", "publicado")
        .contains("metadata", { slug: body.slug })
        .maybeSingle();

      if (project) {
        ownerId = project.user_id;
        projectId = project.id;
        const metadata = (project.metadata ?? {}) as {
          productIds?: string[];
          price?: number | string;
          elementOverrides?: Record<string, { textContent?: string }>;
        };
        const productIds: string[] = Array.isArray(metadata.productIds) ? metadata.productIds : [];
        if (productIds.length > 0) {
          const { data: products } = await admin.rpc("get_public_store_products", { p_ids: productIds });
          const first = Array.isArray(products) ? products[0] : null;
          if (first) {
            catalogProductId = first.id;
            productTitle = first.title || productTitle;
            const imgs = Array.isArray(first.images) ? first.images : [];
            productImage = imgs[0] ?? null;
            unitPrice = Number(first.suggested_price ?? 0);
          }
        }
        // Preço editado pelo dono no editor tem prioridade sobre o do catálogo.
        // Espelha src/lib/userProjects.ts#resolveProjectPrice para o Pix sair
        // exatamente com o "Total" mostrado no carrinho/checkout:
        // 1) metadata.price (número gravado pelo editor atual);
        // 2) projetos antigos: menor valor "R$ ..." nos elementOverrides.
        const edited = resolveEditedPrice(metadata);
        if (edited !== null) unitPrice = edited;
        if (!productTitle || productTitle === "Produto") productTitle = project.nome;
      }

    }

    if (!ownerId) return json({ error: "Página não encontrada." }, 404);
    if (!unitPrice || unitPrice <= 0) return json({ error: "Preço inválido para esta página." }, 400);

    const quantity = Math.max(1, Math.min(10, Number(body.quantity ?? 1)));
    const subtotal = Number((unitPrice * quantity).toFixed(2));
    const tip = sanitizeTip(body.tip);
    const total = Number((subtotal + SERVICE_FEE_BRL + TAX_BRL + tip).toFixed(2));

    // 2) Pedido pendente
    const externalRef = `store_${crypto.randomUUID()}`;
    const { data: orderRow, error: orderErr } = await admin
      .from("store_orders")
      .insert({
        user_id: ownerId,
        sales_page_id: salesPageId,
        project_id: projectId,
        catalog_product_id: catalogProductId,
        product_title: productTitle,
        product_image_url: productImage,
        quantity,
        unit_price: unitPrice,
        total,
        buyer_name: body.buyer.name.trim().slice(0, 200),
        buyer_email: body.buyer.email.trim().toLowerCase().slice(0, 200),
        buyer_phone: body.buyer.phone?.slice(0, 40) ?? null,
        buyer_cpf: cpf.slice(0, 14),
        shipping_address: body.shipping ?? null,
        payment_method: "pix",
        payment_status: "pending",
        mp_external_reference: externalRef,
      })
      .select("id")
      .single();

    if (orderErr || !orderRow) {
      console.error("store_orders insert error:", orderErr);
      return json({ error: "Falha ao registrar pedido." }, 500);
    }

    // 3) Cobrança Pix na ValidaPay (valor dinâmico)
    let charge: { chargeId?: string; pix?: { emv?: string }; status?: string };
    try {
      charge = await validaPayFetch<{ chargeId?: string; pix?: { emv?: string }; status?: string }>(
        "/v1/charges",
        {
          method: "POST",
          scope: "pix.cob/write pix.cob/read",
          body: JSON.stringify({
            amount: total,
            paymentMethod: "pix",
            description: productTitle.slice(0, 120),
            externalId: externalRef,
            customer: {
              name: body.buyer.name.trim().slice(0, 120),
              email: body.buyer.email.trim().toLowerCase(),
              documentNumber: cpf,
              ...(body.buyer.phone ? { phone: body.buyer.phone.replace(/\D/g, "") } : {}),
            },
            metadata: {
              kind: "store_order",
              store_order_id: orderRow.id,
              subtotal,
              tip,
              service_fee: SERVICE_FEE_BRL,
              tax: TAX_BRL,
              owner_user_id: ownerId,
              slug: body.slug,
            },
          }),
        },
      );
    } catch (err) {
      const detail = err instanceof ValidaPayError ? JSON.stringify(err.details) : String(err);
      console.error("validapay charge error:", detail);
      await admin
        .from("store_orders")
        .update({ payment_status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", orderRow.id);
      return json({ error: "Não foi possível gerar o Pix. Confira os dados e tente novamente." }, 400);
    }

    const pixCode = charge?.pix?.emv ?? null;
    if (!charge?.chargeId || !pixCode) {
      console.error("validapay charge sem pix:", JSON.stringify(charge));
      return json({ error: "O gateway não devolveu o código Pix. Tente novamente." }, 502);
    }

    await admin
      .from("store_orders")
      .update({
        mp_payment_id: String(charge.chargeId),
        pix_qr_code: pixCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderRow.id);

    return json({
      order_id: orderRow.id,
      payment_id: charge.chargeId,
      status: "pending",
      pix_qr_code: pixCode,
      pix_qr_code_base64: null,
      subtotal,
      tip,
      service_fee: SERVICE_FEE_BRL,
      tax: TAX_BRL,
      total,
    });
  } catch (err) {
    console.error("public-sales-checkout error:", err);
    return json({ error: "Erro interno no checkout." }, 500);
  }
});
