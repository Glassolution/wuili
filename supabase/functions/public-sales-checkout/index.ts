// Checkout público das páginas de vendas geradas pelos usuários.
// Cria pagamento no Mercado Pago (Pix ou cartão) e persiste um registro em store_orders.
// O dono da página recebe o pedido no dashboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
  shipping?: {
    zip?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
  quantity?: number;
  card_token?: string;
  installments?: number;
  issuer_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

    const dbUrl = Deno.env.get("DB_URL") ?? Deno.env.get("SUPABASE_URL")!;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(dbUrl, dbKey);

    const body = (await req.json()) as Body;

    if (!body?.slug || !body?.payment_method || !body?.buyer?.name || !body?.buyer?.email) {
      return new Response(JSON.stringify({ error: "campos obrigatórios ausentes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Resolver a página de vendas via slug — tenta generated_sales_pages primeiro
    //    e, em seguida, user_projects (loja gerada pelo editor).
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
        // Pega o primeiro produto do projeto, se houver
        const productIds: string[] = Array.isArray((project.metadata as { productIds?: string[] })?.productIds)
          ? (project.metadata as { productIds?: string[] }).productIds ?? []
          : [];
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
        if (!productTitle || productTitle === "Produto") productTitle = project.nome;
      }
    }

    if (!ownerId) {
      return new Response(JSON.stringify({ error: "página não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!unitPrice || unitPrice <= 0) {
      return new Response(JSON.stringify({ error: "preço inválido para a página" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quantity = Math.max(1, Math.min(10, Number(body.quantity ?? 1)));
    const total = Number((unitPrice * quantity).toFixed(2));

    // 2) Criar registro pending em store_orders (pega o id como external_reference)
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
        buyer_cpf: body.buyer.cpf?.replace(/\D/g, "").slice(0, 14) ?? null,
        shipping_address: body.shipping ?? null,
        payment_method: body.payment_method,
        payment_status: "pending",
        mp_external_reference: externalRef,
      })
      .select("id")
      .single();

    if (orderErr || !orderRow) {
      console.error("store_orders insert error:", orderErr);
      return new Response(JSON.stringify({ error: "falha ao registrar pedido" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Criar pagamento no Mercado Pago
    const mpPayload: Record<string, unknown> = {
      transaction_amount: total,
      description: productTitle,
      payer: { email: body.buyer.email, first_name: body.buyer.name.split(" ")[0] },
      external_reference: externalRef,
      metadata: {
        kind: "store_order",
        store_order_id: orderRow.id,
        owner_user_id: ownerId,
        slug: body.slug,
      },
    };

    if (body.payment_method === "pix") {
      mpPayload.payment_method_id = "pix";
    } else {
      if (!body.card_token) {
        return new Response(JSON.stringify({ error: "card_token obrigatório para cartão" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      mpPayload.token = body.card_token;
      mpPayload.installments = body.installments ?? 1;
      if (body.issuer_id) mpPayload.issuer_id = body.issuer_id;
    }

    const mpResp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": externalRef,
      },
      body: JSON.stringify(mpPayload),
    });
    const mpData = await mpResp.json();

    if (!mpResp.ok) {
      console.error("MP payment error:", mpData);
      await admin
        .from("store_orders")
        .update({ payment_status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", orderRow.id);
      return new Response(JSON.stringify({ error: "erro no pagamento", details: mpData }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Atualizar store_orders com dados do pagamento
    const pixQr: string | null =
      mpData.point_of_interaction?.transaction_data?.qr_code ?? null;
    const pixQrBase64: string | null =
      mpData.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;

    const paymentStatus =
      mpData.status === "approved"
        ? "approved"
        : mpData.status === "rejected" || mpData.status === "cancelled"
        ? "rejected"
        : "pending";

    await admin
      .from("store_orders")
      .update({
        mp_payment_id: String(mpData.id),
        payment_status: paymentStatus,
        pix_qr_code: pixQr,
        pix_qr_code_base64: pixQrBase64,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderRow.id);

    return new Response(
      JSON.stringify({
        order_id: orderRow.id,
        payment_id: mpData.id,
        status: paymentStatus,
        pix_qr_code: pixQr,
        pix_qr_code_base64: pixQrBase64,
        total,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("public-sales-checkout error:", err);
    return new Response(JSON.stringify({ error: "erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
