/**
 * FAQ do Atlas resolvido em código.
 *
 * A maior parte das perguntas de navegação é sempre a mesma ("onde conecto o
 * Mercado Livre?", "como cancelo minha assinatura?"). Responder isso com um
 * modelo é gastar token para reescrever um texto que nunca muda. Aqui a
 * resposta sai pronta, em custo zero, e o modelo só entra quando a pergunta
 * realmente exige raciocínio ou geração de conteúdo.
 *
 * Regra de segurança do casamento: só responde quando a mensagem é curta e
 * bate com um padrão específico. Na dúvida, devolve null e deixa o modelo
 * cuidar — errar para o lado do modelo custa alguns centavos, errar para o
 * lado do texto fixo custa a confiança do usuário.
 */

export type AtlasFaqNavigation = {
  type: "navigation";
  label: string;
  route: string;
  variant?: "primary";
};

export type AtlasFaqEntry = {
  id: string;
  /** Precisa casar para a resposta fixa ser usada. */
  pattern: RegExp;
  /** Se presente, pelo menos um destes também precisa aparecer. */
  requires?: RegExp;
  message: string;
  actions?: AtlasFaqNavigation[];
};

const nav = (label: string, route: string, variant?: "primary"): AtlasFaqNavigation => ({
  type: "navigation",
  label,
  route,
  ...(variant ? { variant } : {}),
});

export const ATLAS_FAQ: AtlasFaqEntry[] = [
  {
    id: "conectar_ml",
    pattern: /\b(conectar|conecto|conexao|vincular|integrar|ligar)\b/,
    requires: /\b(mercado livre|mercadolivre|ml|marketplace)\b/,
    message:
      "Conectar o Mercado Livre leva menos de um minuto. 😄\n\n1. Abra **Integrações** no menu lateral.\n2. Clique em **Conectar Mercado Livre**.\n3. Faça login no site oficial do ML e autorize a Velo.\n\nVocê volta para cá com a conexão ativa e já pode publicar.",
    actions: [nav("Abrir Integrações", "/dashboard/integracoes", "primary")],
  },
  {
    id: "onde_catalogo",
    pattern: /\b(onde|como)\b.*\b(catalogo|produtos?)\b|\b(achar|encontrar|buscar|escolher)\b.*\bprodutos?\b/,
    message:
      "Os produtos ficam no **Catálogo**, no menu lateral. Lá você filtra por categoria, vê preço sugerido e margem, e importa o que quiser vender.\n\nPróximo passo: abrir o Catálogo e escolher um produto com boa margem.",
    actions: [nav("Abrir Catálogo", "/dashboard/catalogo", "primary")],
  },
  {
    id: "onde_pedidos",
    pattern: /\b(onde|como)\b.*\b(pedidos?|vendas?|minhas vendas)\b/,
    message:
      "Suas vendas aparecem em **Pedidos**, no menu lateral. Elas chegam automaticamente da conta do Mercado Livre que você conectou.\n\nSe uma venda não apareceu, confira em Integrações se a conta conectada é a mesma que vendeu.",
    actions: [nav("Abrir Pedidos", "/dashboard/pedidos", "primary")],
  },
  {
    id: "onde_publicacoes",
    pattern: /\b(onde|como)\b.*\b(publicacoes|publicacao|anuncios?|meus anuncios)\b/,
    message:
      "Tudo que você já publicou fica em **Publicações**. Ali dá para ver o status de cada anúncio, abrir no Mercado Livre e excluir se precisar.",
    actions: [nav("Abrir Publicações", "/dashboard/publicacoes", "primary")],
  },
  {
    id: "planos_precos",
    pattern: /\b(plano|planos|preco|precos|quanto custa|valor da assinatura|assinar)\b/,
    message:
      "Os planos ficam em **Planos**, dentro do painel. Lá aparecem os valores atuais e o que cada plano libera: quantidade de produtos publicados, páginas de venda, lojas e recursos de IA.\n\nAbra a página de Planos para ver o preço de hoje.",
    actions: [nav("Ver Planos", "/dashboard/planos", "primary")],
  },
  {
    id: "cancelar_assinatura",
    pattern: /\b(cancelar|cancelamento|encerrar)\b/,
    requires: /\b(assinatura|plano|conta)\b/,
    message:
      "Para cancelar: **Pagamentos > Minha assinatura > Cancelar**.\n\nSeu acesso continua até o fim do ciclo já pago, e os anúncios que você publicou seguem no Mercado Livre normalmente.",
    actions: [nav("Abrir Pagamentos", "/dashboard/pagamentos")],
  },
  {
    id: "reembolso",
    pattern: /\b(reembolso|estorno|devolver o dinheiro|quero meu dinheiro)\b/,
    message:
      "O pedido de reembolso é feito em **Pagamentos > Solicitar reembolso**. A análise leva até 48h úteis e, se aprovado, o valor volta no meio de pagamento original em 5 a 10 dias úteis.",
    actions: [nav("Abrir Pagamentos", "/dashboard/pagamentos")],
  },
  {
    id: "pagina_de_vendas",
    pattern: /\b(pagina de venda|pagina de vendas|landing page|criar pagina|gerar pagina)\b/,
    message:
      "A página de vendas é gerada com IA em **Páginas com IA**. Você escolhe o produto, responde algumas preferências, escolhe o template e a Velo monta a página inteira, já editável.",
    actions: [nav("Criar página com IA", "/dashboard/paginas-com-ia/gerar", "primary")],
  },
  {
    id: "temas_loja",
    pattern: /\b(tema|temas|template|templates|modelo de loja|modelos de loja)\b/,
    message:
      "Os temas de loja ficam em **Templates**. Você escolhe o visual, e depois personaliza tudo no editor sem precisar mexer em código.",
    actions: [nav("Ver Templates", "/dashboard/modelos", "primary")],
  },
  {
    id: "afiliados",
    pattern: /\b(afiliado|afiliados|indicacao|indicar|comissao|comissoes)\b/,
    message:
      "O programa de afiliados fica em **Comissões**, no painel. Ali você pega seu link de indicação, acompanha as conversões e pede o saque das comissões.",
    actions: [nav("Abrir Comissões", "/dashboard/comissoes", "primary")],
  },
  {
    id: "anuncio_pausado",
    pattern: /\b(pausado|pausou|pausada|despausar)\b/,
    requires: /\b(anuncio|anuncios|publicacao|produto)\b/,
    message:
      "Anúncio pausado normalmente é uma destas três coisas: o fornecedor ficou sem estoque, faltou um atributo obrigatório na ficha, ou o Mercado Livre aplicou uma regra de categoria.\n\nSe for estoque, o anúncio volta sozinho quando o fornecedor repõe. Abra Publicações para ver o motivo exato do seu caso.",
    actions: [nav("Abrir Publicações", "/dashboard/publicacoes")],
  },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** Mensagem longa quase nunca é pergunta de FAQ: é pedido de conteúdo. */
const MAX_FAQ_CHARS = 160;

export const resolveAtlasFaq = (message: string) => {
  const raw = message.trim();
  if (!raw || raw.length > MAX_FAQ_CHARS) return null;

  const normalized = normalize(raw);
  // Pedido de geração de conteúdo nunca é FAQ, mesmo curto.
  if (/\b(escreva|escrever|gere|gerar|crie|criar titulo|titulo|descricao|texto|copy|otimiz)\b/.test(normalized)) {
    return null;
  }

  for (const entry of ATLAS_FAQ) {
    if (!entry.pattern.test(normalized)) continue;
    if (entry.requires && !entry.requires.test(normalized)) continue;
    return entry;
  }
  return null;
};
