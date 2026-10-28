// Descobre a qual produto do catálogo um anúncio pertence quando o vínculo
// (catalog_product_id) não veio na publicação. Sem esse vínculo a venda chega
// sem link da fornecedora e o botão mostra "Fornecedor indisponível".
//
// Ordem: código SKU do anúncio (não muda se o vendedor trocar o título) →
// título idêntico → primeira foto → início do título.
// Só aceita resultado único; em caso de dúvida devolve null (nunca chuta).

export type CatalogLinkRow = {
  id: string;
  external_id: string | null;
  product_url: string | null;
  title: string | null;
  stock_quantity: number | null;
  is_active: boolean | null;
  match_kind: string;
};

// deno-lint-ignore no-explicit-any -- cliente Supabase com service role, tipagem varia por função
export async function resolveCatalogLink(supabase: any, title: string | null | undefined, thumbnail: string | null | undefined, sku?: string | null): Promise<CatalogLinkRow | null> {
  const s = (sku ?? "").trim();
  if (s && s !== "SKU-001") {
    try {
      const { data } = await supabase
        .from("catalog_products")
        .select("id, external_id, product_url, title, stock_quantity, is_active")
        .eq("external_id", s)
        .maybeSingle();
      if (data?.id) return { ...data, match_kind: "sku" } as CatalogLinkRow;
    } catch (_e) { /* segue para as outras formas */ }
  }
  const t = (title ?? "").trim();
  const img = (thumbnail ?? "").trim();
  if (!t && !img) return null;
  try {
    const { data, error } = await supabase.rpc("resolve_catalog_product_for_listing", {
      p_title: t || null,
      p_thumbnail: img || null,
    });
    if (error) {
      console.warn("[catalog-link] falha ao resolver vínculo:", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return row?.id ? (row as CatalogLinkRow) : null;
  } catch (e) {
    console.warn("[catalog-link] erro ao resolver vínculo:", (e as Error).message);
    return null;
  }
}

/**
 * Grava o vínculo descoberto no anúncio, para as próximas vendas já chegarem
 * certas. Só preenche quando está vazio e ignora conflito com outro anúncio
 * do mesmo produto (o índice único impede dois vínculos iguais).
 */
// deno-lint-ignore no-explicit-any -- cliente Supabase com service role
export async function healPublicationLink(supabase: any, userId: string, mlItemId: string, externalId: string | null) {
  if (!externalId) return;
  try {
    const { error } = await supabase
      .from("user_publications")
      .update({ catalog_product_id: externalId })
      .eq("user_id", userId)
      .eq("ml_item_id", mlItemId)
      .is("catalog_product_id", null);
    if (error && (error as { code?: string }).code !== "23505") {
      console.warn("[catalog-link] não gravou vínculo no anúncio:", error.message);
    }
  } catch (e) {
    console.warn("[catalog-link] erro ao gravar vínculo:", (e as Error).message);
  }
}
