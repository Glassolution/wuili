import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase, withFreshSupabaseSession } from "@/integrations/supabase/client";
import type { NichoDaVitrine } from "@/contexts/AtlasChatContext";
import {
  CATEGORIAS_EXCLUIDAS,
  categoriasDoPerfil,
  lerRespostasDoQuiz,
  motivoDaRecomendacao,
  pontuarProdutoParaPerfil,
  resumoDoPerfil,
  type RespostasDoQuiz,
} from "@/lib/perfilDoQuiz";

/**
 * Seleção de produtos do guia, cruzando o quiz de cadastro com o catálogo.
 *
 * Vive num hook, e não dentro do componente, porque a mesma seleção aparece em
 * dois lugares: no painel lateral do Atlas e no chat em tela cheia. Antes essa
 * lógica morava no modal da vitrine — quando a vitrine virou carrossel dentro
 * da conversa, a busca ficou aqui para os dois renderizadores usarem a mesma.
 */

export type ProdutoRecomendado = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  imagem: string;
  rating: number | null;
  ordersCount: number | null;
  motivo: string;
};

type LinhaDoCatalogo = {
  id: string;
  title: string | null;
  category: string | null;
  cost_price: number | null;
  images: unknown;
  rating: number | null;
  orders_count: number | null;
};

/** Quantos cards entram no carrossel. */
const QUANTIDADE_DE_CARDS = 8;

/**
 * Teto de produtos da mesma categoria.
 *
 * Sem isso o carrossel enche de oito variações do mesmo item quando o nicho é
 * estreito, e a seleção parece uma busca, não uma recomendação.
 */
const MAXIMO_POR_CATEGORIA = 3;

/** Mesmo tratamento de imagem do catálogo: o campo vem como json ou string. */
const primeiraImagem = (images: unknown): string | null => {
  const lista = Array.isArray(images)
    ? images
    : typeof images === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(images);
            return Array.isArray(parsed) ? parsed : [images];
          } catch {
            return [images];
          }
        })()
      : [];
  const primeira = lista.find((item) => typeof item === "string" && item.startsWith("http"));
  return typeof primeira === "string" ? primeira : null;
};

type Retorno = {
  produtos: ProdutoRecomendado[];
  carregando: boolean;
  erro: string | null;
  /** Frase que explica em que a seleção se baseou, para o cabeçalho. */
  resumo: string;
  respostas: RespostasDoQuiz;
};

export const useProdutosRecomendados = (
  nicho: NichoDaVitrine | null,
  /** Piso de tempo do esqueleto, para a busca não piscar e sumir. */
  tempoMinimoMs = 900,
): Retorno => {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState<ProdutoRecomendado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const respostas = useMemo(() => lerRespostasDoQuiz(user), [user]);
  const resumo = useMemo(() => resumoDoPerfil(respostas), [respostas]);
  // Só os termos importam para a busca; o objeto do nicho muda de identidade a
  // cada render do chat e reiniciaria a consulta sem necessidade.
  const termosDoNicho = useMemo(() => nicho?.catalogTerms ?? [], [nicho]);
  const chaveDosTermos = termosDoNicho.join("|");
  const userId = user?.id ?? null;

  // Guarda o piso de tempo só na primeira busca: reconsultas silenciosas não
  // precisam segurar o esqueleto de novo.
  const jaBuscouRef = useRef(false);

  useEffect(() => {
    let ativo = true;

    const buscar = async () => {
      const abertoEm = Date.now();
      setCarregando(true);
      setErro(null);
      try {
        const categorias = categoriasDoPerfil(respostas);
        const termos = chaveDosTermos ? chaveDosTermos.split("|") : [];

        const base = () =>
          supabase
            .from("catalog_products")
            .select("id,title,category,cost_price,images,rating,orders_count")
            .eq("is_blocked", false)
            .gt("stock_quantity", 0)
            .not("category", "in", `(${CATEGORIAS_EXCLUIDAS.map((c) => `"${c}"`).join(",")})`);

        // Três consultas: o nicho confirmado na conversa, o nicho do cadastro e
        // a geral. A geral entra como complemento porque um nicho estreito pode
        // ter poucos produtos com estoque, e o carrossel ficaria com dois cards.
        const [doNichoDaConversa, doNichoDoQuiz, gerais] = await Promise.all([
          termos.length > 0
            ? withFreshSupabaseSession(() =>
                base()
                  .or(termos.map((termo) => `category.ilike.%${termo}%,title.ilike.%${termo}%`).join(","))
                  .order("orders_count", { ascending: false, nullsFirst: false })
                  .limit(60),
              )
            : Promise.resolve({ data: [], error: null }),
          categorias.length > 0
            ? withFreshSupabaseSession(() => base().in("category", categorias).limit(60))
            : Promise.resolve({ data: [], error: null }),
          withFreshSupabaseSession(() =>
            base().order("orders_count", { ascending: false, nullsFirst: false }).limit(60),
          ),
        ]);

        if (doNichoDaConversa.error) throw doNichoDaConversa.error;
        if (doNichoDoQuiz.error) throw doNichoDoQuiz.error;
        if (gerais.error) throw gerais.error;

        const idsDoNichoDaConversa = new Set(
          ((doNichoDaConversa.data as LinhaDoCatalogo[]) ?? []).map((linha) => linha.id),
        );

        const porId = new Map<string, LinhaDoCatalogo>();
        for (const linha of [
          ...((doNichoDaConversa.data as LinhaDoCatalogo[]) ?? []),
          ...((doNichoDoQuiz.data as LinhaDoCatalogo[]) ?? []),
          ...((gerais.data as LinhaDoCatalogo[]) ?? []),
        ]) {
          if (!porId.has(linha.id)) porId.set(linha.id, linha);
        }

        const ranqueados = [...porId.values()]
          .map((linha) => {
            const imagem = primeiraImagem(linha.images);
            if (!imagem) return null;
            const produto = {
              id: linha.id,
              nome: linha.title || "Produto do catálogo Velo",
              categoria: linha.category || "Produto",
              preco: linha.cost_price || 0,
              imagem,
              rating: linha.rating,
              ordersCount: linha.orders_count,
            };
            // O bônus mantém o nicho confirmado no topo sem descartar o perfil:
            // a ordem final é nicho primeiro, e dentro dele o que combina com
            // as respostas do cadastro.
            const bonusDoNicho = idsDoNichoDaConversa.has(linha.id) ? 100 : 0;
            const pontos =
              pontuarProdutoParaPerfil(produto, respostas, { produtoId: linha.id, userId }) + bonusDoNicho;
            return { produto, pontos };
          })
          .filter((item): item is { produto: Omit<ProdutoRecomendado, "motivo">; pontos: number } => Boolean(item))
          .sort((a, b) => b.pontos - a.pontos);

        // Passa uma vez respeitando o teto por categoria e, se ainda faltar
        // card, completa com o resto na ordem da pontuação.
        const escolhidos: Array<Omit<ProdutoRecomendado, "motivo">> = [];
        const usados = new Set<string>();
        const porCategoria = new Map<string, number>();
        for (const { produto } of ranqueados) {
          if (escolhidos.length >= QUANTIDADE_DE_CARDS) break;
          const quantos = porCategoria.get(produto.categoria) ?? 0;
          if (quantos >= MAXIMO_POR_CATEGORIA) continue;
          porCategoria.set(produto.categoria, quantos + 1);
          escolhidos.push(produto);
          usados.add(produto.id);
        }
        for (const { produto } of ranqueados) {
          if (escolhidos.length >= QUANTIDADE_DE_CARDS) break;
          if (usados.has(produto.id)) continue;
          escolhidos.push(produto);
          usados.add(produto.id);
        }

        const selecionados = escolhidos.map((produto) => ({
          ...produto,
          motivo: motivoDaRecomendacao(produto, respostas),
        }));

        if (!jaBuscouRef.current) {
          const restante = tempoMinimoMs - (Date.now() - abertoEm);
          if (restante > 0) await new Promise((resolve) => setTimeout(resolve, restante));
        }

        if (!ativo) return;
        jaBuscouRef.current = true;
        setProdutos(selecionados);
        setCarregando(false);
      } catch (e) {
        if (!ativo) return;
        setErro(e instanceof Error ? e.message : "Não consegui carregar os produtos agora");
        setCarregando(false);
      }
    };

    void buscar();
    return () => {
      ativo = false;
    };
  }, [chaveDosTermos, respostas, tempoMinimoMs, userId]);

  return { produtos, carregando, erro, resumo, respostas };
};
